import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { pendingRuns } from './recurring'
import {
  hasChangesSince,
  initialState,
  mergeState,
  readStoredState,
  reducer,
  writeStoredState,
  type Action,
} from './store'
import {
  anmeldeFehlerAusAdresse,
  anmeldeFehlerText,
  cloudConfigured,
  raeumeAnmeldeFehler,
  supabase,
} from './supabase'
import { erklaereFehler } from './diagnose'
import { pruefeZugang, pullAll, pushChanges, subscribeShared } from './sync'
import type { State } from './types'

/**
 * Der Rahmen um alles: Zustand, Anmeldung und Abgleich.
 *
 * Die Reihenfolge ist wichtig. Erst kommt der lokale Zustand – die App ist
 * sofort bedienbar, auch ohne Konto und ohne Netz. Der Abgleich hängt sich
 * danach an, wenn Zugangsdaten hinterlegt sind und jemand angemeldet ist.
 */

export type CloudStatus =
  /** Keine Zugangsdaten hinterlegt – die App läuft rein lokal. */
  | 'aus'
  /** Zugangsdaten da, aber niemand angemeldet. */
  | 'abgemeldet'
  | 'laedt'
  | 'verbunden'
  | 'fehler'

export interface Session {
  userId: string
  email: string
}

interface AppValue {
  state: State
  dispatch: (action: Action) => void
  cloudStatus: CloudStatus
  cloudError: string | null
  session: Session | null
  signIn: (email: string, passwort: string) => Promise<void>
  signOut: () => Promise<void>
  /**
   * Ist diese Adresse für die geteilten Daten freigeschaltet?
   *
   * `null` heißt „noch nicht nachgesehen“. Die Unterscheidung ist wichtig:
   * Eine nicht freigeschaltete Person bekommt von den Zugriffsregeln keine
   * Fehlermeldung, sondern eine leere Liste – und eine leere Einkaufsliste
   * sieht aus wie eine leere Einkaufsliste. Ohne diese Angabe wäre die Sperre
   * unsichtbar.
   */
  zugang: boolean | null
}

const AppContext = createContext<AppValue | null>(null)

/** Wartezeit, bevor Änderungen zum Server gehen. */
const PUSH_DELAY = 800

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    typeof window === 'undefined' ? initialState() : readStoredState(),
  )
  const [session, setSession] = useState<Session | null>(null)
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(cloudConfigured ? 'abgemeldet' : 'aus')
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [zugang, setZugang] = useState<boolean | null>(null)

  const stateRef = useRef(state)
  stateRef.current = state

  // Der Zeitpunkt, bis zu dem alles hochgeladen ist. Alles Jüngere wartet auf
  // den nächsten Schub. In einer Ref, damit ein Wechsel keinen Neuaufbau
  // auslöst – sonst hinge der Abgleich in einer Schleife aus sich selbst.
  const pushedUpTo = useRef(0)

  /* --- Lokal sichern --- */

  useEffect(() => {
    writeStoredState(state)
  }, [state])

  /* --- Anmeldung --- */

  useEffect(() => {
    if (!supabase) return
    let active = true

    // Ein abgewiesener Link hängt als Anhang an der Adresse. Ohne diese Zeile
    // öffnet sich die App und tut so, als sei nichts gewesen.
    const abgewiesen = anmeldeFehlerAusAdresse()
    if (abgewiesen) {
      setCloudError(abgewiesen)
      raeumeAnmeldeFehler()
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const user = data.session?.user
      setSession(user ? { userId: user.id, email: user.email ?? '' } : null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      const user = next?.user
      setSession(user ? { userId: user.id, email: user.email ?? '' } : null)
      if (user) setCloudError(null)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  /**
   * Anmelden mit E-Mail und Passwort.
   *
   * Bewusst ohne jede E-Mail: Vorher lief die Anmeldung über einen Code aus
   * einer Mail, und genau daran scheiterte sie. Der eingebaute Mailversand von
   * Supabase ist auf wenige Nachrichten je Stunde gedrosselt, ein Code gilt nur
   * eine Stunde, und ob er überhaupt in der Mail steht, hängt an einer Vorlage
   * im Dashboard, die niemand von hier aus prüfen kann. Ein Passwort hat keine
   * dieser Eigenschaften – und der Schlüsselbund des Telefons trägt es ein.
   *
   * Die Konten legt man in Supabase an, nicht hier. Warum, steht in der README:
   * Ohne bestätigte Adresse wäre die Zugangsliste wertlos, denn sie
   * entscheidet anhand der E-Mail-Adresse.
   */
  const signIn = useCallback(async (email: string, passwort: string) => {
    if (!supabase) return
    setCloudError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: passwort,
    })
    if (error) setCloudError(anmeldeFehlerText(error))
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setSession(null)
    setCloudStatus('abgemeldet')
    // Der lokale Bestand bleibt liegen. Wer sich abmeldet, will nicht seine
    // Einkaufsliste verlieren.
  }, [])

  /* --- Abgleich --- */

  /**
   * Anmelden genügt: Danach läuft alles.
   *
   * Erst wird nachgesehen, ob diese Adresse freigeschaltet ist – nicht aus
   * Höflichkeit, sondern weil die Zugriffsregeln sonst schweigend leere Listen
   * liefern und die App „verbunden“ meldete, während nichts ankommt.
   */
  useEffect(() => {
    if (!supabase || !session) return
    let active = true

    ;(async () => {
      setCloudStatus('laedt')
      try {
        const erlaubt = await pruefeZugang(supabase!)
        if (!active) return
        setZugang(erlaubt)

        const { incoming, errors } = await pullAll(supabase!, { userId: session.userId })
        if (!active) return

        // Fehlende Tabellen sind kein Grund, das Wenige wegzuwerfen, das
        // ankam – aber sehr wohl einer, es zu sagen. Sonst behauptet die App
        // „verbunden“, während nichts hoch- oder runtergeht.
        if (errors.length > 0) {
          dispatch({ type: 'sync/merge', incoming })
          setCloudStatus('fehler')
          setCloudError(erklaereFehler(errors[0]!.error))
          return
        }

        /*
         * Erst zusammenführen, dann hochladen – und zwar das Ergebnis.
         *
         * `dispatch` wirkt nicht sofort; ein direkt danach gelesener `stateRef`
         * enthält noch den Stand von vorher. Wer den hochlädt, schiebt genau
         * die Fassungen zurück, die gerade vom Server kamen: Ihr Häkchen von
         * eben würde mit seinem älteren Stand überschrieben. Deshalb wird hier
         * dieselbe Rechnung noch einmal ausgeführt und das Ergebnis geschickt.
         */
        const zusammengefuehrt = mergeState(stateRef.current, incoming)
        dispatch({ type: 'sync/merge', incoming })

        // Ab 0, nicht ab jetzt: Alles, was lokal entstand, solange niemand
        // angemeldet war, muss mit. Sonst bliebe die eigene Einkaufsliste für
        // immer auf dem Gerät – und genau diesen Weg geht man.
        const at = Date.now()
        await pushChanges(supabase!, zusammengefuehrt, { userId: session.userId, since: 0 })
        if (!active) return
        pushedUpTo.current = at
        setCloudStatus('verbunden')
        setCloudError(
          erlaubt
            ? null
            : 'Diese Adresse ist für die gemeinsame Einkaufsliste nicht freigeschaltet. Deine Buchungen werden trotzdem gesichert.',
        )
      } catch (error) {
        if (!active) return
        // Der lokale Bestand bleibt vollständig nutzbar – nur eben allein.
        setCloudStatus('fehler')
        setCloudError(
          erklaereFehler(
            error && typeof error === 'object' ? (error as { code?: string; message?: string }) : null,
          ),
        )
      }
    })()

    return () => {
      active = false
    }
  }, [session])

  /* --- Laufender Abgleich --- */

  useEffect(() => {
    if (!supabase || !session || cloudStatus === 'laedt') return

    const timer = window.setTimeout(() => {
      const since = pushedUpTo.current
      // Nichts Neues? Dann auch keine Anfrage. Welche Listen dazuzählen, steht
      // in `store.ts` an einer Stelle – hier eine zweite Aufzählung zu führen
      // hatte schon einmal zur Folge, dass geteilte Notizen nie hochgingen.
      if (!hasChangesSince(state, since)) return

      const at = Date.now()
      void pushChanges(supabase!, state, { userId: session.userId, since })
        .then(() => {
          pushedUpTo.current = at
          setCloudStatus('verbunden')
        })
        .catch(() => {
          // Beim nächsten Durchlauf wird es erneut versucht; `pushedUpTo`
          // bleibt stehen, damit nichts verloren geht.
          setCloudStatus('fehler')
        })
    }, PUSH_DELAY)

    return () => window.clearTimeout(timer)
  }, [state, session, cloudStatus])

  /* --- Live-Änderungen der anderen --- */

  useEffect(() => {
    // Auch ohne Freischaltung anmelden: Die Zugriffsregeln entscheiden, ob
    // etwas durchkommt, und wer gerade erst freigeschaltet wurde, bekommt so
    // die nächste Änderung sofort mit, ohne die App neu zu starten.
    if (!supabase || !session) return
    return subscribeShared(supabase, (incoming) => {
      dispatch({ type: 'sync/merge', incoming })
    })
  }, [session])

  /* --- Wiederkehrende Buchungen nachholen --- */

  useEffect(() => {
    // Einmal beim Start und danach nur, wenn sich die Regeln ändern. Der
    // Zustand selbst darf hier nicht in der Abhängigkeitsliste stehen: Jede
    // erzeugte Buchung ändert ihn, und die Wirkung liefe endlos im Kreis.
    for (const run of pendingRuns({ recurringTxs: stateRef.current.recurringTxs })) {
      dispatch({ type: 'recurring/run', id: run.id, dates: run.dates })
    }
  }, [state.recurringTxs])

  /* --- Farbschema --- */

  useEffect(() => {
    const root = document.documentElement
    const theme = state.settings.theme
    // Bewusst `data-choice` und nicht `data-theme`: Letzteres gehört der
    // Umgebung, in der die App läuft. Schriebe die App hinein, überschriebe
    // sie deren Umschalter. Bei „System“ steht hier nichts – dann entscheidet
    // die Umgebung, sonst das Betriebssystem.
    if (theme === 'system') delete root.dataset.choice
    else root.dataset.choice = theme
  }, [state.settings.theme])

  const value = useMemo<AppValue>(
    () => ({
      state,
      dispatch,
      cloudStatus,
      cloudError,
      session,
      signIn,
      signOut,
      zugang,
    }),
    [
      state,
      cloudStatus,
      cloudError,
      session,
      signIn,
      signOut,
      zugang,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp braucht den AppProvider')
  return value
}

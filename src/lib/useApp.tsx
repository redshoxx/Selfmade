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
import { offeneEinladung, vergissEinladung } from './einladung'
import { newInviteCode } from './id'
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
import { anmeldeFehlerAusAdresse, cloudConfigured, raeumeAnmeldeFehler, redirectTo, supabase } from './supabase'
import { erklaereFehler } from './diagnose'
import {
  createHousehold as rpcCreate,
  joinHousehold as rpcJoin,
  leaveHousehold as rpcLeave,
  loadHousehold,
  pullAll,
  pushChanges,
  rotateInviteCode,
  subscribeShared,
} from './sync'
import type { Household, State } from './types'

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
  signIn: (email: string) => Promise<void>
  /** Anmeldung mit dem sechsstelligen Code aus der Mail. */
  verifyCode: (email: string, token: string) => Promise<void>
  signOut: () => Promise<void>
  createHousehold: (name: string) => Promise<void>
  joinHousehold: (code: string) => Promise<void>
  leaveHousehold: () => Promise<void>
  /** Neuen Einladungscode vergeben; der alte gilt dann nicht mehr. */
  renewInviteCode: () => Promise<void>
  /** Anmeldelink verschickt – die Oberfläche zeigt dann den Hinweis. */
  magicLinkSentTo: string | null
  /** Ein Einladungslink wurde geöffnet und wartet auf den Beitritt. */
  pendingInvite: string | null
  /** Gerade beigetreten – für die Rückmeldung, dass es geklappt hat. */
  joinedHousehold: string | null
  clearJoined: () => void
  /** Eine Einladung liegenlassen, ohne ihr zu folgen. */
  dismissInvite: () => void
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
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null)
  const [joinedHousehold, setJoinedHousehold] = useState<string | null>(null)

  // Einen Einladungslink gleich beim Aufbau aufnehmen – vor allem anderen.
  // Die Anmeldung führt gleich über den Server und kommt ohne die
  // ursprüngliche Adresse zurück; wer erst danach nachsieht, sieht nichts mehr.
  const [pendingInvite, setPendingInvite] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : offeneEinladung(),
  )

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
      if (user) {
        setMagicLinkSentTo(null)
        setCloudError(null)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string) => {
    if (!supabase) return
    setCloudError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    })
    if (error) {
      setCloudError(
        error.message.toLowerCase().includes('rate')
          ? 'Zu viele Anfragen. Warte eine Minute und versuch es noch einmal.'
          : 'Der Anmeldelink konnte nicht verschickt werden.',
      )
      return
    }
    setMagicLinkSentTo(email.trim())
  }, [])

  /**
   * Anmelden mit dem Code aus der Mail statt über den Link.
   *
   * Auf dem iPhone ist das nicht die zweite Wahl, sondern der einzige Weg, der
   * zuverlässig funktioniert: Eine vom Homescreen gestartete Web-App hat ihren
   * eigenen Speicher. Der Link in der Mail öffnet aber Safari – die Anmeldung
   * landet dort und kommt in der App nie an. Ein abgetippter Code bleibt, wo
   * er eingegeben wurde.
   */
  const verifyCode = useCallback(async (email: string, token: string) => {
    if (!supabase) return
    setCloudError(null)
    const ziffern = token.replace(/\D/g, '')
    if (ziffern.length < 6) {
      setCloudError('Der Code besteht aus sechs Ziffern.')
      return
    }

    const adresse = email.trim()
    const ersterVersuch = await supabase.auth.verifyOtp({ email: adresse, token: ziffern, type: 'email' })
    if (!ersterVersuch.error) return

    // Wer sich zum ersten Mal anmeldet, bekommt die Bestätigungsmail statt der
    // Anmeldemail – und deren Code gilt unter einem anderen Typ. Welcher Fall
    // vorliegt, weiß die App nicht, also probiert sie den zweiten mit.
    const zweiterVersuch = await supabase.auth.verifyOtp({ email: adresse, token: ziffern, type: 'signup' })
    if (!zweiterVersuch.error) return

    setCloudError('Der Code stimmt nicht oder ist abgelaufen. Fordere einen neuen an.')
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setSession(null)
    setCloudStatus('abgemeldet')
    // Der lokale Bestand bleibt liegen. Wer sich abmeldet, will nicht seine
    // Einkaufsliste verlieren.
  }, [])

  /* --- Haushalt --- */

  /**
   * Nachsehen, zu welchem Haushalt das Konto gehört.
   *
   * Bei einem Fehler bleibt der bekannte Haushalt stehen. Vorher wurde er
   * gelöscht, sobald die Abfrage schiefging – ein Funkloch beim Start reichte,
   * und die App bot wieder „Haushalt anlegen“ an, während nichts mehr geteilt
   * wurde.
   */
  const refreshHousehold = useCallback(async (userId: string): Promise<Household | null> => {
    if (!supabase) return null
    const ergebnis = await loadHousehold(supabase, userId)
    if (ergebnis.status === 'ok') {
      dispatch({ type: 'household/set', household: ergebnis.household })
      return ergebnis.household
    }
    if (ergebnis.status === 'keiner') {
      dispatch({ type: 'household/set', household: null })
      return null
    }
    return stateRef.current.household
  }, [])

  const createHousehold = useCallback(
    async (name: string) => {
      if (!supabase || !session) return
      setCloudError(null)
      try {
        const household = await rpcCreate(supabase, {
          name,
          memberName: stateRef.current.settings.displayName,
          code: newInviteCode(),
        })
        dispatch({ type: 'household/set', household })
        await refreshHousehold(session.userId)
      } catch (error) {
        setCloudError(error instanceof Error ? error.message : 'Das hat nicht geklappt.')
      }
    },
    [session, refreshHousehold],
  )

  const joinHousehold = useCallback(
    async (code: string) => {
      if (!supabase || !session) return
      setCloudError(null)
      try {
        await rpcJoin(supabase, { code, memberName: stateRef.current.settings.displayName })
        const household = await refreshHousehold(session.userId)
        // Die Einladung ist eingelöst; sie darf beim nächsten Start nicht
        // erneut aufpoppen.
        vergissEinladung()
        setPendingInvite(null)
        if (household) setJoinedHousehold(household.name)
      } catch (error) {
        setCloudError(error instanceof Error ? error.message : 'Das hat nicht geklappt.')
      }
    },
    [session, refreshHousehold],
  )

  const leaveHousehold = useCallback(async () => {
    if (!supabase || !session || !stateRef.current.household) return
    await rpcLeave(supabase, stateRef.current.household.id, session.userId)
    dispatch({ type: 'household/set', household: null })
  }, [session])

  const renewInviteCode = useCallback(async () => {
    if (!supabase || !session || !stateRef.current.household) return
    setCloudError(null)
    try {
      await rotateInviteCode(supabase, stateRef.current.household.id, newInviteCode)
      await refreshHousehold(session.userId)
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : 'Das hat nicht geklappt.')
    }
  }, [session, refreshHousehold])

  const clearJoined = useCallback(() => setJoinedHousehold(null), [])

  const dismissInvite = useCallback(() => {
    vergissEinladung()
    setPendingInvite(null)
  }, [])

  /**
   * Einem Einladungslink von selbst folgen.
   *
   * Nur, wenn noch kein Haushalt da ist. Wer schon in einem steht, würde durch
   * einen versehentlich angetippten alten Link sonst aus seinem herausfallen –
   * das entscheidet niemand außer ihm selbst, und dafür gibt es im Teilen-Blatt
   * eine Schaltfläche.
   */
  const householdId = state.household?.id ?? null
  useEffect(() => {
    if (!pendingInvite || !session || householdId) return
    void joinHousehold(pendingInvite)
  }, [pendingInvite, session, householdId, joinHousehold])

  /* --- Abgleich --- */

  /**
   * Hängt am Haushalt, nicht nur an der Anmeldung.
   *
   * Sonst käme nach dem Beitritt nichts an: Die Einträge des anderen liegen
   * schon auf dem Server, es gibt also keine Live-Änderung, auf die man
   * horchen könnte. Ohne dieses zweite Auslösen sähe die Freundin nach dem
   * Beitritt eine leere Liste – bis sie die App das nächste Mal neu startet.
   */
  useEffect(() => {
    if (!supabase || !session) return
    let active = true

    ;(async () => {
      setCloudStatus('laedt')
      try {
        const household = await refreshHousehold(session.userId)
        if (!active) return

        const { incoming, errors } = await pullAll(supabase!, {
          userId: session.userId,
          householdId: household?.id ?? null,
        })
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

        // Ab 0, nicht ab jetzt: Was lokal entstand, solange niemand angemeldet
        // war – und alles, was vor dem Beitritt schon auf der Liste stand –
        // muss mit. Sonst bliebe die eigene Einkaufsliste für immer auf dem
        // Gerät, und genau diesen Weg geht man.
        const at = Date.now()
        await pushChanges(supabase!, zusammengefuehrt, {
          userId: session.userId,
          householdId: household?.id ?? null,
          since: 0,
        })
        if (!active) return
        pushedUpTo.current = at
        setCloudStatus('verbunden')
        setCloudError(null)
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
  }, [session, householdId, refreshHousehold])

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
      void pushChanges(supabase!, state, {
        userId: session.userId,
        householdId: state.household?.id ?? null,
        since,
      })
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
    if (!supabase || !session || !householdId) return
    return subscribeShared(supabase, householdId, (incoming) => {
      dispatch({ type: 'sync/merge', incoming })
    })
  }, [session, householdId])

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
      verifyCode,
      signOut,
      createHousehold,
      joinHousehold,
      leaveHousehold,
      renewInviteCode,
      magicLinkSentTo,
      pendingInvite,
      joinedHousehold,
      clearJoined,
      dismissInvite,
    }),
    [
      state,
      cloudStatus,
      cloudError,
      session,
      signIn,
      verifyCode,
      signOut,
      createHousehold,
      joinHousehold,
      leaveHousehold,
      renewInviteCode,
      magicLinkSentTo,
      pendingInvite,
      joinedHousehold,
      clearJoined,
      dismissInvite,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp braucht den AppProvider')
  return value
}

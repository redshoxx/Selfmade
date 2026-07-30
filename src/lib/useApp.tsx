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
import { newInviteCode } from './id'
import { pendingRuns } from './recurring'
import { initialState, readStoredState, reducer, writeStoredState, type Action } from './store'
import { cloudConfigured, redirectTo, supabase } from './supabase'
import {
  createHousehold as rpcCreate,
  joinHousehold as rpcJoin,
  leaveHousehold as rpcLeave,
  loadHousehold,
  pullAll,
  pushChanges,
  subscribeShared,
} from './sync'
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
  signIn: (email: string) => Promise<void>
  signOut: () => Promise<void>
  createHousehold: (name: string) => Promise<void>
  joinHousehold: (code: string) => Promise<void>
  leaveHousehold: () => Promise<void>
  /** Anmeldelink verschickt – die Oberfläche zeigt dann den Hinweis. */
  magicLinkSentTo: string | null
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

  /* --- Lokal sichern --- */

  useEffect(() => {
    writeStoredState(state)
  }, [state])

  /* --- Anmeldung --- */

  useEffect(() => {
    if (!supabase) return
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const user = data.session?.user
      setSession(user ? { userId: user.id, email: user.email ?? '' } : null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      const user = next?.user
      setSession(user ? { userId: user.id, email: user.email ?? '' } : null)
      if (user) setMagicLinkSentTo(null)
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
      setCloudError('Der Anmeldelink konnte nicht verschickt werden.')
      return
    }
    setMagicLinkSentTo(email.trim())
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

  const refreshHousehold = useCallback(async (userId: string) => {
    if (!supabase) return null
    const household = await loadHousehold(supabase, userId)
    dispatch({ type: 'household/set', household })
    return household
  }, [])

  const createHousehold = useCallback(
    async (name: string) => {
      if (!supabase || !session) return
      setCloudError(null)
      try {
        const household = await rpcCreate(supabase, {
          name,
          memberName: state.settings.displayName,
          code: newInviteCode(),
        })
        dispatch({ type: 'household/set', household })
        await refreshHousehold(session.userId)
      } catch (error) {
        setCloudError(error instanceof Error ? error.message : 'Das hat nicht geklappt.')
      }
    },
    [session, state.settings.displayName, refreshHousehold],
  )

  const joinHousehold = useCallback(
    async (code: string) => {
      if (!supabase || !session) return
      setCloudError(null)
      try {
        await rpcJoin(supabase, { code, memberName: state.settings.displayName })
        await refreshHousehold(session.userId)
      } catch (error) {
        setCloudError(error instanceof Error ? error.message : 'Das hat nicht geklappt.')
      }
    },
    [session, state.settings.displayName, refreshHousehold],
  )

  const leaveHousehold = useCallback(async () => {
    if (!supabase || !session || !state.household) return
    await rpcLeave(supabase, state.household.id, session.userId)
    dispatch({ type: 'household/set', household: null })
  }, [session, state.household])

  /* --- Erster Abgleich nach der Anmeldung --- */

  // Der Zeitpunkt, bis zu dem alles hochgeladen ist. Alles Jüngere wartet auf
  // den nächsten Schub. In einer Ref, damit ein Wechsel keinen Neuaufbau
  // auslöst – sonst hinge der Abgleich in einer Schleife aus sich selbst.
  const pushedUpTo = useRef(0)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (!supabase || !session) return
    let active = true

    ;(async () => {
      setCloudStatus('laedt')
      try {
        const household = await refreshHousehold(session.userId)
        if (!active) return

        const incoming = await pullAll(supabase!, {
          userId: session.userId,
          householdId: household?.id ?? null,
        })
        if (!active) return
        dispatch({ type: 'sync/merge', incoming })

        // Was lokal entstanden ist, solange niemand angemeldet war, muss jetzt
        // hoch. Deshalb ab 0 – nicht ab dem Zeitpunkt der Anmeldung.
        await pushChanges(supabase!, stateRef.current, {
          userId: session.userId,
          householdId: household?.id ?? null,
          since: 0,
        })
        if (!active) return
        pushedUpTo.current = Date.now()
        setCloudStatus('verbunden')
      } catch {
        if (!active) return
        // Der lokale Bestand bleibt vollständig nutzbar – nur eben allein.
        setCloudStatus('fehler')
        setCloudError('Kein Kontakt zum Server. Die App läuft weiter, Änderungen gehen später raus.')
      }
    })()

    return () => {
      active = false
    }
  }, [session, refreshHousehold])

  /* --- Laufender Abgleich --- */

  useEffect(() => {
    if (!supabase || !session || cloudStatus === 'laedt') return

    const timer = window.setTimeout(() => {
      const since = pushedUpTo.current
      // Nichts Neues? Dann auch keine Anfrage.
      const hasChanges = [
        state.txs,
        state.pots,
        state.potEntries,
        state.challenges,
        state.shopItems,
        state.pantryItems,
      ].some((list) => list.some((item) => item.updatedAt > since))
      if (!hasChanges) return

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
    if (!supabase || !session || !state.household) return
    return subscribeShared(supabase, state.household.id, (incoming) => {
      dispatch({ type: 'sync/merge', incoming })
    })
  }, [session, state.household?.id])

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
      createHousehold,
      joinHousehold,
      leaveHousehold,
      magicLinkSentTo,
    }),
    [
      state,
      cloudStatus,
      cloudError,
      session,
      signIn,
      signOut,
      createHousehold,
      joinHousehold,
      leaveHousehold,
      magicLinkSentTo,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp braucht den AppProvider')
  return value
}

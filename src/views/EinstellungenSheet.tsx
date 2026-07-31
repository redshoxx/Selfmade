import { useState } from 'react'
import { Field, TapRow } from '../components/Bits'
import { IconUsers } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { pruefeVerbindung, type CheckResult } from '../lib/diagnose'
import { normalizeInviteCode } from '../lib/id'
import { live } from '../lib/store'
import { cloudConfigured, supabase } from '../lib/supabase'
import { useApp } from '../lib/useApp'
import type { Settings } from '../lib/types'

/**
 * Einstellungen – und das Teilen.
 *
 * Das Teilen steht hier oben, weil es der einzige Schritt ist, den man einmal
 * gehen muss und danach nie wieder. Alles andere sind Kleinigkeiten.
 */
export function EinstellungenSheet({ onClose }: { onClose: () => void }) {
  const {
    state,
    dispatch,
    session,
    cloudStatus,
    cloudError,
    signIn,
    signOut,
    createHousehold,
    joinHousehold,
    leaveHousehold,
    magicLinkSentTo,
  } = useApp()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState(state.settings.displayName)
  const [busy, setBusy] = useState(false)
  const [checks, setChecks] = useState<CheckResult[] | null>(null)
  const [checking, setChecking] = useState(false)

  const set = (patch: Partial<Settings>) => dispatch({ type: 'settings/update', patch })

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    try {
      await task()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Einstellungen" onClose={onClose}>
      <h2 className="section" style={{ marginTop: 0 }}>
        <IconUsers size={14} /> Zu zweit nutzen
      </h2>

      {!cloudConfigured ? (
        <div className="card pad">
          <p className="small" style={{ margin: 0 }}>
            Zum Teilen fehlen die Zugangsdaten zum Server. Sie gehören in eine Datei <code>.env</code>;
            in <code>README.md</code> steht, wie das geht. Bis dahin läuft die App vollständig auf
            diesem Gerät – alle Bereiche funktionieren, nur eben allein.
          </p>
        </div>
      ) : !session ? (
        <div className="card pad">
          {magicLinkSentTo ? (
            <p className="small" style={{ margin: 0 }}>
              Wir haben einen Anmeldelink an <strong>{magicLinkSentTo}</strong> geschickt. Öffne ihn
              auf diesem Gerät, dann geht es hier weiter.
            </p>
          ) : (
            <>
              <p className="small muted" style={{ marginTop: 0 }}>
                Melde dich mit deiner E-Mail-Adresse an. Du bekommst einen Link zugeschickt – ein
                Passwort brauchst du nicht.
              </p>
              <Field label="E-Mail">
                <input
                  className="input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="du@beispiel.de"
                />
              </Field>
              <button
                type="button"
                className="btn btn-primary btn-wide"
                disabled={!email.includes('@') || busy}
                onClick={() => run(() => signIn(email))}
              >
                Anmeldelink schicken
              </button>
            </>
          )}
        </div>
      ) : state.household ? (
        <div className="card pad">
          <div className="spread">
            <strong>{state.household.name}</strong>
            <span className="tag tag-good">verbunden</span>
          </div>
          <p className="small muted" style={{ marginTop: 6 }}>
            Einkaufsliste und Vorrat teilst du mit
            {state.household.members.length > 1
              ? ` ${state.household.members.length} Personen`
              : ' allen, die diesen Code eingeben'}
            . Deine Buchungen und Spartöpfe bleiben privat.
          </p>

          <span className="field-label" style={{ marginTop: 12 }}>
            Einladungscode
          </span>
          <div className="code">{state.household.inviteCode}</div>
          <p className="small muted" style={{ marginTop: 6 }}>
            Diesen Code gibt deine Freundin bei sich unter „Beitreten“ ein.
          </p>

          {state.household.members.length > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              {state.household.members.map((member) => (
                <TapRow key={member.userId || member.name} title={member.name} />
              ))}
            </div>
          )}

          <div className="btn-row">
            <button
              type="button"
              className="btn btn-danger btn-wide"
              disabled={busy}
              onClick={() => run(leaveHousehold)}
            >
              Haushalt verlassen
            </button>
          </div>
        </div>
      ) : (
        <div className="card pad">
          <p className="small muted" style={{ marginTop: 0 }}>
            Angemeldet als {session.email}. Leg einen Haushalt an und gib den Code weiter – oder tritt
            mit einem Code bei, den du bekommen hast.
          </p>

          <button
            type="button"
            className="btn btn-primary btn-wide"
            disabled={busy}
            onClick={() => run(() => createHousehold('Zuhause'))}
          >
            Haushalt anlegen
          </button>

          <p className="small muted">
            Beim Beitreten werden deine Einkaufsliste und dein Vorrat mit der
            geteilten <strong>zusammengelegt</strong>. Buchungen, Spartöpfe und
            Challenges bleiben privat – die sieht niemand außer dir.
          </p>

          <Field label="… oder mit Code beitreten">
            <input
              className="input"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="K7M-2QD"
              autoCapitalize="characters"
              autoComplete="off"
              style={{ letterSpacing: '0.1em', textAlign: 'center' }}
            />
          </Field>
          <button
            type="button"
            className="btn btn-wide"
            disabled={normalizeInviteCode(code).length !== 7 || busy}
            onClick={() => run(() => joinHousehold(normalizeInviteCode(code)))}
          >
            Beitreten
          </button>
        </div>
      )}

      {cloudError && (
        <div className="notice notice-warn" style={{ marginTop: 12 }}>
          <span aria-hidden="true">!</span>
          <span>{cloudError}</span>
        </div>
      )}

      {cloudStatus === 'fehler' && !cloudError && (
        <div className="notice notice-warn" style={{ marginTop: 12 }}>
          <span aria-hidden="true">!</span>
          <span>Gerade kein Kontakt zum Server. Änderungen gehen raus, sobald es wieder geht.</span>
        </div>
      )}

      {/* Der Abgleich läuft im Hintergrund; läuft er nicht, sieht man dem
          Bildschirm das nicht an. Diese Prüfung beantwortet die Frage, die man
          dann hat – und nennt zu jedem Punkt den nächsten Schritt. */}
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-wide"
          disabled={checking}
          onClick={async () => {
            setChecking(true)
            setChecks(null)
            try {
              setChecks(
                await pruefeVerbindung({
                  client: supabase,
                  configured: cloudConfigured,
                  userId: session?.userId ?? null,
                  householdId: state.household?.id ?? null,
                }),
              )
            } finally {
              setChecking(false)
            }
          }}
        >
          {checking ? 'Wird geprüft …' : 'Verbindung prüfen'}
        </button>
      </div>

      {checks && (
        <>
          <div className="check-list" style={{ marginTop: 12 }}>
            {checks.map((check) => (
              <div key={check.label} className="check-item">
                <span className={`check-mark check-mark-${check.state}`} aria-hidden="true">
                  {check.state === 'ok' ? '✓' : check.state === 'uebersprungen' ? '–' : '!'}
                </span>
                <span className="check-body">
                  <span className="check-label">{check.label}</span>
                  <span className="check-detail">{check.detail}</span>
                </span>
              </div>
            ))}
          </div>

          {checks.some((c) => c.state === 'fehler') && (
            <p className="small muted" style={{ marginTop: 10 }}>
              Der häufigste Grund: Das Schema ist noch nicht eingespielt. Öffne dein Supabase-Projekt,
              geh in den SQL-Editor und führe den Inhalt von <code>supabase/schema.sql</code> aus.
              Das Skript lässt sich beliebig oft wiederholen.
            </p>
          )}

          {state.household && checks.every((c) => c.state !== 'fehler') && (
            <p className="small muted" style={{ marginTop: 10 }}>
              Auf diesem Gerät: {live(state.shopItems).length} Einträge auf der Liste,{' '}
              {live(state.pantryItems).length} im Vorrat. Weichen die Zahlen oben davon ab, läuft der
              Abgleich noch – gib ihm einen Moment.
            </p>
          )}
        </>
      )}

      <h2 className="section">Ich</h2>
      <div className="card pad">
        <Field label="Angezeigter Name">
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => set({ displayName: name.trim() || 'Ich' })}
            placeholder="Ich"
          />
        </Field>
        <p className="small muted" style={{ margin: 0 }}>
          Steht in der geteilten Liste hinter dem, was du aufschreibst.
        </p>
      </div>

      <h2 className="section">Darstellung</h2>
      <div className="card pad">
        <span className="field-label">Farben</span>
        <div className="segmented">
          {(['system', 'hell', 'dunkel'] as const).map((theme) => (
            <button
              key={theme}
              type="button"
              aria-pressed={state.settings.theme === theme}
              onClick={() => set({ theme })}
            >
              {theme === 'system' ? 'System' : theme === 'hell' ? 'Hell' : 'Dunkel'}
            </button>
          ))}
        </div>

        <div className="spread" style={{ marginTop: 16 }}>
          <span>
            Kurzes Rütteln beim Abhaken
            <span className="row-sub">Wo das Gerät es kann</span>
          </span>
          <button
            type="button"
            className={`btn${state.settings.haptics ? ' btn-primary' : ''}`}
            onClick={() => set({ haptics: !state.settings.haptics })}
            aria-pressed={state.settings.haptics}
            style={{ minWidth: 74 }}
          >
            {state.settings.haptics ? 'An' : 'Aus'}
          </button>
        </div>
      </div>

      {session && (
        <div className="btn-row">
          <button type="button" className="btn btn-wide" disabled={busy} onClick={() => run(signOut)}>
            Abmelden
          </button>
        </div>
      )}

      <p className="small muted" style={{ marginTop: 18, textAlign: 'center' }}>
        Deine Daten liegen auf diesem Gerät. Was du teilst, liegt zusätzlich auf deinem eigenen
        Supabase-Projekt – sonst nirgends.
      </p>
    </Sheet>
  )
}

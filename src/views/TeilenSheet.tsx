import { useState } from 'react'
import { Field, TapRow } from '../components/Bits'
import { IconUsers } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { pruefeVerbindung, type CheckResult } from '../lib/diagnose'
import { einladungsLink, teileEinladung } from '../lib/einladung'
import { normalizeInviteCode } from '../lib/id'
import { live } from '../lib/store'
import { cloudConfigured, supabase } from '../lib/supabase'
import { useApp } from '../lib/useApp'

/**
 * Zu zweit nutzen – alles dazu an einer Stelle.
 *
 * Vorher stand das Teilen als ein Block unter vielen in den Einstellungen,
 * zwischen Farbwahl und Anzeigename. Es ist aber kein Schalter, sondern ein
 * Weg: anmelden, Haushalt anlegen, Einladung schicken. Ein Weg braucht einen
 * eigenen Raum, in dem immer nur der nächste Schritt sichtbar ist.
 */
export function TeilenSheet({ onClose }: { onClose: () => void }) {
  const {
    state,
    session,
    cloudError,
    signIn,
    verifyCode,
    createHousehold,
    joinHousehold,
    leaveHousehold,
    renewInviteCode,
    magicLinkSentTo,
    pendingInvite,
    joinedHousehold,
    clearJoined,
    dismissInvite,
  } = useApp()

  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [verlassenGefragt, setVerlassenGefragt] = useState(false)
  const [checks, setChecks] = useState<CheckResult[] | null>(null)
  const [checking, setChecking] = useState(false)

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    try {
      await task()
    } finally {
      setBusy(false)
    }
  }

  const link = state.household ? einladungsLink(state.household.inviteCode, window.location.origin) : ''

  const einladungSchicken = async () => {
    if (!state.household) return
    const ergebnis = await teileEinladung(link, state.household.name)
    if (ergebnis === 'kopiert') setHinweis('Link kopiert – füg ihn in eine Nachricht ein.')
    else if (ergebnis === 'fehler') setHinweis('Das Weitergeben ging nicht. Der Link steht unten zum Abtippen.')
    else setHinweis(null)
  }

  return (
    <Sheet title="Zu zweit nutzen" onClose={onClose}>
      {/* --- Ohne Zugangsdaten geht nichts davon --- */}
      {!cloudConfigured ? (
        <div className="card pad">
          <p className="small" style={{ margin: 0 }}>
            Diese Fassung der App läuft ohne Server – alle Bereiche funktionieren, aber nur auf diesem
            Gerät. Zum Teilen braucht sie eine eigene Adresse mit hinterlegten Zugangsdaten; wie das
            geht, steht in <code>README.md</code>.
          </p>
        </div>
      ) : !session ? (
        <>
          {pendingInvite && (
            <div className="notice notice-info">
              <span aria-hidden="true">👥</span>
              <span>
                Du wurdest eingeladen. Melde dich kurz an – danach bist du automatisch dabei.
              </span>
            </div>
          )}

          <div className="card pad">
            {magicLinkSentTo ? (
              <>
                <p className="small" style={{ marginTop: 0 }}>
                  Wir haben dir eine E-Mail an <strong>{magicLinkSentTo}</strong> geschickt. Tipp den
                  sechsstelligen Code daraus hier ein.
                </p>

                <Field label="Code aus der E-Mail">
                  <input
                    className="input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={token}
                    onChange={(event) => setToken(event.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    style={{ letterSpacing: '0.28em', textAlign: 'center', fontSize: 20 }}
                  />
                </Field>
                <button
                  type="button"
                  className="btn btn-primary btn-wide"
                  disabled={token.length < 6 || busy}
                  onClick={() => run(() => verifyCode(magicLinkSentTo, token))}
                >
                  Anmelden
                </button>

                {/* Auf dem iPhone ist der Code nicht die Notlösung, sondern der
                    verlässliche Weg: Eine vom Homescreen gestartete App hat
                    ihren eigenen Speicher, der Link in der Mail öffnet aber
                    Safari – dort landet die Anmeldung und bleibt liegen. */}
                <p className="small muted" style={{ marginBottom: 0 }}>
                  In derselben Mail steht auch ein Link. Der funktioniert im Browser; hast du die App
                  auf dem Homescreen, nimm den Code.
                </p>
                <button
                  type="button"
                  className="btn btn-wide"
                  disabled={busy}
                  onClick={() => run(() => signIn(magicLinkSentTo))}
                >
                  Neuen Code schicken
                </button>
              </>
            ) : (
              <>
                <p className="small muted" style={{ marginTop: 0 }}>
                  Melde dich mit deiner E-Mail-Adresse an. Du bekommst einen Code zugeschickt – ein
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
                  Code schicken
                </button>
              </>
            )}
          </div>
        </>
      ) : state.household ? (
        <>
          {/* Eine Einladung zu einem *anderen* Haushalt. Von selbst folgt die
              App ihr nicht: Ein versehentlich angetippter Link würde sonst aus
              dem eigenen Haushalt herauswerfen. Das entscheidet nur, wer hier
              draufdrückt. */}
          {pendingInvite && pendingInvite !== state.household.inviteCode && (
            <div className="card pad">
              <p className="small" style={{ marginTop: 0 }}>
                Du hast eine Einladung zu einem anderen Haushalt geöffnet. Wechselst du, verlässt du
                „{state.household.name}“ und siehst dessen Liste nicht mehr.
              </p>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary btn-wide"
                  disabled={busy}
                  onClick={() => run(() => joinHousehold(pendingInvite))}
                >
                  Haushalt wechseln
                </button>
                <button type="button" className="btn btn-wide" onClick={dismissInvite}>
                  Hierbleiben
                </button>
              </div>
            </div>
          )}

          {joinedHousehold && (
            <div className="notice notice-good">
              <span aria-hidden="true">✓</span>
              <span>
                Du bist jetzt bei „{joinedHousehold}“. Eure Einkaufslisten und Vorräte sind
                zusammengelegt.
                <button
                  type="button"
                  className="link"
                  onClick={clearJoined}
                  style={{ marginLeft: 8 }}
                >
                  ok
                </button>
              </span>
            </div>
          )}

          <div className="card pad">
            <div className="spread">
              <strong>{state.household.name}</strong>
              <span className="tag tag-good">
                {state.household.members.length > 1
                  ? `${state.household.members.length} Personen`
                  : 'nur du'}
              </span>
            </div>
            <p className="small muted" style={{ marginTop: 6, marginBottom: 14 }}>
              Einkaufsliste, Vorrat und Notizen seht ihr gemeinsam. Buchungen, Spartöpfe und
              Challenges bleiben privat – die sieht niemand außer dir.
            </p>

            {/* Ein Link statt eines Codes: vorlesen, richtig hören und richtig
                tippen fällt damit weg, und das Teilen-Blatt des Systems hat
                WhatsApp und Nachrichten ohnehin schon an Bord. */}
            <button type="button" className="btn btn-primary btn-wide" onClick={einladungSchicken}>
              Einladung schicken
            </button>

            {hinweis && (
              <p className="small" style={{ marginTop: 8, marginBottom: 0 }}>
                {hinweis}
              </p>
            )}

            <details style={{ marginTop: 14 }}>
              <summary className="small muted">Lieber den Code vorlesen?</summary>
              <div className="code" style={{ marginTop: 8 }}>
                {state.household.inviteCode}
              </div>
              <p className="small muted" style={{ marginTop: 6 }}>
                Den gibt sie bei sich unter „Mit Code beitreten“ ein. I, O, 0 und 1 kommen nicht vor –
                da kann sich niemand verhören.
              </p>
              <button
                type="button"
                className="btn btn-wide"
                disabled={busy}
                onClick={() => run(renewInviteCode)}
              >
                Neuen Code erzeugen
              </button>
              <p className="small muted" style={{ marginBottom: 0 }}>
                Der alte Link und der alte Code gelten dann nicht mehr. Wer schon dabei ist, bleibt
                dabei.
              </p>
            </details>
          </div>

          {state.household.members.length > 0 && (
            <>
              <h2 className="section">Wer dabei ist</h2>
              <div className="card">
                {state.household.members.map((member) => (
                  <TapRow
                    key={member.userId || member.name}
                    title={member.name}
                    sub={member.userId === session.userId ? 'du' : undefined}
                  />
                ))}
              </div>
            </>
          )}

          <div className="btn-row">
            {verlassenGefragt ? (
              <div className="card pad">
                <p className="small" style={{ marginTop: 0 }}>
                  Danach siehst du die gemeinsame Liste nicht mehr. Was jetzt darauf steht, bleibt auf
                  diesem Gerät liegen.
                </p>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-danger btn-wide"
                    disabled={busy}
                    onClick={() => run(async () => {
                      await leaveHousehold()
                      setVerlassenGefragt(false)
                    })}
                  >
                    Ja, verlassen
                  </button>
                  <button type="button" className="btn btn-wide" onClick={() => setVerlassenGefragt(false)}>
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn-wide" onClick={() => setVerlassenGefragt(true)}>
                Haushalt verlassen
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {pendingInvite && (
            <div className="notice notice-info">
              <span aria-hidden="true">👥</span>
              <span>Einladung wird eingelöst …</span>
            </div>
          )}

          <div className="card pad">
            <p className="small muted" style={{ marginTop: 0 }}>
              Angemeldet als {session.email}.
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
              Danach bekommst du einen Link zum Weitergeben. Wer ihn antippt, sieht dieselbe
              Einkaufsliste und denselben Vorrat.
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
            <p className="small muted" style={{ marginBottom: 0 }}>
              Beim Beitreten werden deine Einkaufsliste und dein Vorrat mit der geteilten{' '}
              <strong>zusammengelegt</strong>.
            </p>
          </div>
        </>
      )}

      {cloudError && (
        <div className="notice notice-warn" style={{ marginTop: 12 }}>
          <span aria-hidden="true">!</span>
          <span>{cloudError}</span>
        </div>
      )}

      {/* Der Abgleich läuft im Hintergrund; läuft er nicht, sieht man dem
          Bildschirm das nicht an. Diese Prüfung beantwortet die Frage, die man
          dann hat – und nennt zu jedem Punkt den nächsten Schritt. */}
      {cloudConfigured && (
        <details style={{ marginTop: 18 }}>
          <summary className="small muted">Es kommt nichts an?</summary>

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
                  Der häufigste Grund: Das Schema ist noch nicht eingespielt. Öffne dein
                  Supabase-Projekt, geh in den SQL-Editor und führe den Inhalt von{' '}
                  <code>supabase/schema.sql</code> aus. Das Skript lässt sich beliebig oft
                  wiederholen.
                </p>
              )}

              {state.household && checks.every((c) => c.state !== 'fehler') && (
                <p className="small muted" style={{ marginTop: 10 }}>
                  Auf diesem Gerät: {live(state.shopItems).length} Einträge auf der Liste,{' '}
                  {live(state.pantryItems).length} im Vorrat. Weichen die Zahlen oben davon ab, läuft
                  der Abgleich noch – gib ihm einen Moment.
                </p>
              )}
            </>
          )}
        </details>
      )}

      <p className="small muted" style={{ marginTop: 18, textAlign: 'center' }}>
        <IconUsers size={13} /> Geteilt wird nur, was oben steht. Alles zum Geld bleibt bei dir.
      </p>
    </Sheet>
  )
}

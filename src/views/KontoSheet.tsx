import { useCallback, useEffect, useState } from 'react'
import { Field, TapRow } from '../components/Bits'
import { IconTrash, IconUsers } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { pruefeVerbindung, type CheckResult } from '../lib/diagnose'
import { entfernePerson, erlaubePerson, ladeErlaubte } from '../lib/sync'
import { live } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/useApp'
import type { Person } from '../lib/types'

/**
 * Konto – anmelden und festlegen, wer mitliest.
 *
 * Was hier fehlt, ist das Bemerkenswerte: kein Haushalt, kein Einladungscode,
 * kein Beitreten. Drei Schritte, an denen man scheitern konnte, für eine
 * Frage, die zu zweit ohnehin nur einmal beantwortet wird. Wer angemeldet und
 * freigeschaltet ist, sieht dieselbe Einkaufsliste – ohne Zutun.
 */
export function KontoSheet({ onClose }: { onClose: () => void }) {
  const { state, session, cloudError, signIn, signOut, zugang } = useApp()

  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [busy, setBusy] = useState(false)
  const [checks, setChecks] = useState<CheckResult[] | null>(null)
  const [checking, setChecking] = useState(false)

  const [personen, setPersonen] = useState<Person[] | null>(null)
  const [listenFehler, setListenFehler] = useState<string | null>(null)
  const [neueAdresse, setNeueAdresse] = useState('')
  const [neuerName, setNeuerName] = useState('')

  const bereit = email.includes('@') && passwort.length > 0

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    try {
      await task()
    } finally {
      setBusy(false)
    }
  }

  const ladeListe = useCallback(async () => {
    if (!supabase || !session) return
    try {
      setPersonen(await ladeErlaubte(supabase))
      setListenFehler(null)
    } catch (fehler) {
      setPersonen(null)
      setListenFehler(fehler instanceof Error ? fehler.message : 'Die Liste ließ sich nicht laden.')
    }
  }, [session])

  useEffect(() => {
    void ladeListe()
  }, [ladeListe])

  return (
    <Sheet title="Konto" onClose={onClose}>
      {!session ? (
        <div className="card pad">
          <p className="small muted" style={{ marginTop: 0 }}>
            Melde dich an, dann liegen deine Daten auf deinem Supabase-Projekt und sind auf jedem
            Gerät da.
          </p>

          {/* Ein echtes Formular, kein loser Haufen Felder: Nur so füllt der
              Schlüsselbund von iPhone und Android beide Felder aus, und nur so
              meldet die Eingabetaste an. */}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (bereit) void run(() => signIn(email, passwort))
            }}
          >
            <Field label="E-Mail">
              <input
                className="input"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="du@beispiel.de"
              />
            </Field>
            <Field label="Passwort">
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={passwort}
                onChange={(event) => setPasswort(event.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <button type="submit" className="btn btn-primary btn-wide" disabled={!bereit || busy}>
              {busy ? 'Wird geprüft …' : 'Anmelden'}
            </button>
          </form>

          {/* Die Konten entstehen im Dashboard, nicht hier. Ohne bestätigte
              Adresse wäre die Zugangsliste wertlos – sie entscheidet ja
              anhand der E-Mail-Adresse, wer die gemeinsame Liste sieht. */}
          <p className="small muted" style={{ marginBottom: 0 }}>
            Die Zugangsdaten legst du einmal in Supabase an, unter{' '}
            <em>Authentication → Users → Add user</em>, mit Häkchen bei „Auto Confirm User“. In der
            README steht es Schritt für Schritt.
          </p>
        </div>
      ) : (
        <>
          <div className="card pad">
            <div className="spread">
              <strong style={{ overflowWrap: 'anywhere' }}>{session.email}</strong>
              <span className={`tag ${zugang === false ? 'tag-warn' : 'tag-good'}`}>
                {zugang === null ? 'prüft …' : zugang ? 'alles synchron' : 'nur privat'}
              </span>
            </div>
            <p className="small muted" style={{ marginTop: 6, marginBottom: 0 }}>
              {zugang === false
                ? 'Buchungen, Spartöpfe und Challenges werden gesichert. Für Einkaufsliste und Vorrat muss dich jemand freischalten, der schon dabei ist.'
                : 'Alles liegt auf deinem Supabase-Projekt: Buchungen und Spartöpfe nur für dich, Einkaufsliste, Vorrat und Notizen gemeinsam.'}
            </p>
          </div>

          {/* Die Zugangsliste ist die ganze Freigabe. Nötig, weil der Schlüssel
              der App öffentlich ist: Ohne sie käme jeder hinein, der die
              Adresse kennt. */}
          <h2 className="section">
            <IconUsers size={13} /> Wer mitliest
          </h2>

          {listenFehler ? (
            <div className="notice notice-warn">
              <span aria-hidden="true">!</span>
              <span>{listenFehler}</span>
            </div>
          ) : personen === null ? (
            <div className="card pad">
              <p className="small muted" style={{ margin: 0 }}>
                Wird geladen …
              </p>
            </div>
          ) : (
            <>
              <div className="card">
                {personen.map((person) => (
                  <TapRow
                    key={person.email}
                    title={person.name || person.email}
                    sub={person.name ? person.email : undefined}
                    trailing={
                      person.email.toLowerCase() === session.email.toLowerCase() ? (
                        <span className="tag tag-soft">du</span>
                      ) : (
                        <button
                          type="button"
                          aria-label={`${person.email} entfernen`}
                          disabled={busy}
                          style={{ color: 'var(--bad)', padding: 6 }}
                          onClick={() =>
                            run(async () => {
                              if (!supabase) return
                              await entfernePerson(supabase, person.email)
                              await ladeListe()
                            })
                          }
                        >
                          <IconTrash size={18} />
                        </button>
                      )
                    }
                  />
                ))}
                {personen.length === 0 && (
                  <div className="pad">
                    <p className="small muted" style={{ margin: 0 }}>
                      Noch niemand. Trag dich zuerst in <code>supabase/schema.sql</code> ein und spiel
                      es ein – sonst kann dich niemand freischalten.
                    </p>
                  </div>
                )}
              </div>

              {zugang !== false && (
                <div className="card pad" style={{ marginTop: 12 }}>
                  <Field label="Jemanden dazunehmen">
                    <input
                      className="input"
                      type="email"
                      inputMode="email"
                      autoCapitalize="none"
                      autoComplete="off"
                      value={neueAdresse}
                      onChange={(event) => setNeueAdresse(event.target.value)}
                      placeholder="ihre@adresse.de"
                    />
                  </Field>
                  <Field label="Name (wird an ihren Einträgen angezeigt)">
                    <input
                      className="input"
                      value={neuerName}
                      onChange={(event) => setNeuerName(event.target.value)}
                      placeholder="Freundin"
                    />
                  </Field>
                  <button
                    type="button"
                    className="btn btn-primary btn-wide"
                    disabled={!neueAdresse.includes('@') || busy}
                    onClick={() =>
                      run(async () => {
                        if (!supabase) return
                        try {
                          await erlaubePerson(supabase, neueAdresse, neuerName)
                          setNeueAdresse('')
                          setNeuerName('')
                          setListenFehler(null)
                          await ladeListe()
                        } catch (fehler) {
                          setListenFehler(
                            fehler instanceof Error ? fehler.message : 'Das hat nicht geklappt.',
                          )
                        }
                      })
                    }
                  >
                    Freischalten
                  </button>
                  <p className="small muted" style={{ marginBottom: 0 }}>
                    Sie öffnet dann dieselbe Adresse, meldet sich mit genau dieser E-Mail an – und
                    sieht sofort dieselbe Einkaufsliste und denselben Vorrat. Ihr Geld bleibt ihres.
                  </p>
                </div>
              )}
            </>
          )}
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
                setChecks(await pruefeVerbindung({ client: supabase, userId: session?.userId ?? null }))
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
                <code>supabase/schema.sql</code> aus. Das Skript lässt sich beliebig oft wiederholen.
              </p>
            )}

            {checks.every((c) => c.state !== 'fehler') && (
              <p className="small muted" style={{ marginTop: 10 }}>
                Auf diesem Gerät: {live(state.shopItems).length} Einträge auf der Liste,{' '}
                {live(state.pantryItems).length} im Vorrat. Weichen die Zahlen oben davon ab, läuft
                der Abgleich noch – gib ihm einen Moment.
              </p>
            )}
          </>
        )}
      </details>

      {session && (
        <div className="btn-row">
          <button type="button" className="btn btn-wide" disabled={busy} onClick={() => run(signOut)}>
            Abmelden
          </button>
        </div>
      )}

      <p className="small muted" style={{ marginTop: 18, textAlign: 'center' }}>
        Deine Daten liegen auf deinem eigenen Supabase-Projekt – sonst nirgends.
      </p>
    </Sheet>
  )
}

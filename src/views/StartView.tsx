import { useMemo } from 'react'
import { Bar, TapRow } from '../components/Bits'
import { IconCart, IconChevron, IconTarget, IconWallet } from '../components/Icons'
import { isComplete, pace, progress, savedCents, suggestSlot, totalCents } from '../lib/challenges'
import { formatExpiry } from '../lib/date'
import { currentMonth, summarizeMonth, totalSaved } from '../lib/finance'
import { formatMoney, formatSigned } from '../lib/money'
import { entries as pantryEntries, needsAttention, pantryCounts, sortEntries } from '../lib/pantry'
import { shopCounts } from '../lib/shopping'
import { live } from '../lib/store'
import { useApp } from '../lib/useApp'
import type { GoIntent } from '../App'
import type { Tab } from '../lib/types'

/**
 * Die Startseite.
 *
 * Sie beantwortet drei Fragen, ohne dass man tippen muss: Wie steht der Monat?
 * Muss zu Hause etwas weg? Was fehlt beim nächsten Einkauf?
 *
 * Ist noch nichts erfasst, beantwortet sie stattdessen eine vierte: Womit fange
 * ich an? Ein Begrüßungstext, der drei Möglichkeiten *aufzählt*, ohne eine
 * davon anzubieten, lässt Menschen mit einem leeren Bildschirm allein.
 */
export function StartView({
  onGo,
  onKonto,
}: {
  onGo: (tab: Tab, intent?: GoIntent) => void
  onKonto: () => void
}) {
  const { state, session, zugang } = useApp()
  const month = currentMonth()

  const summary = useMemo(() => summarizeMonth(state, month), [state, month])
  const counts = pantryCounts(state)
  const shop = shopCounts(state)
  const gespart = totalSaved(state)

  const ablaufend = useMemo(
    () => sortEntries(pantryEntries(state)).filter((e) => needsAttention(e.expiry.state)).slice(0, 4),
    [state],
  )
  const challenges = useMemo(
    () => live(state.challenges).filter((c) => !c.archived && !isComplete(c)),
    [state.challenges],
  )

  const nichtsLos =
    summary.incomeCents === 0 &&
    summary.expenseCents === 0 &&
    shop.total === 0 &&
    counts.total === 0 &&
    challenges.length === 0

  const name = state.settings.displayName

  if (nichtsLos) {
    return (
      <div className="scroll">
        <div className="head">
          <h1>Hallo{name !== 'Ich' ? ` ${name}` : ''}</h1>
        </div>

        <p className="muted" style={{ margin: '0 2px 18px', fontSize: 15 }}>
          Such dir aus, womit du anfängst.
        </p>

        <div className="stack">
          <Entry
            emoji="💸"
            title="Ausgabe erfassen"
            text="Zwei Tipps: Betrag und Kategorie."
            onClick={() => onGo('geld', { compose: 'ausgabe' })}
          />
          <Entry
            emoji="🛒"
            title="Einkaufsliste füllen"
            text="„2 Milch“ genügt – die Abteilung erkennt die App."
            onClick={() => onGo('einkauf')}
          />
          <Entry
            emoji="🎯"
            title="Spar-Challenge starten"
            text="Die 1-€-Challenge bringt in einem Jahr 1.378 € zusammen."
            onClick={() => onGo('sparen', { challenge: true })}
          />
          <Entry
            emoji="☁️"
            title="Anmelden und sichern"
            text="Daten auf allen Geräten, Einkaufsliste und Vorrat gemeinsam."
            onClick={onKonto}
          />
        </div>

        <p className="small muted" style={{ marginTop: 20, textAlign: 'center' }}>
          Alles bleibt auf diesem Gerät, solange du nichts teilst.
        </p>
      </div>
    )
  }

  return (
    <div className="scroll">
      <div className="head">
        <h1>Hallo{name !== 'Ich' ? ` ${name}` : ''}</h1>
      </div>

      <div className="tiles" style={{ marginBottom: 12 }}>
        <button type="button" className="tile" onClick={() => onGo('geld')}>
          <div className="tile-label">Diesen Monat</div>
          <div
            className="tile-value"
            style={{ color: summary.balanceCents < 0 ? 'var(--bad)' : undefined }}
          >
            {formatSigned(summary.balanceCents)}
          </div>
        </button>
        <button type="button" className="tile" onClick={() => onGo('sparen')}>
          <div className="tile-label">Gespart</div>
          <div className="tile-value">{formatMoney(gespart)}</div>
        </button>
      </div>

      {counts.urgent > 0 && (
        <div className="notice notice-bad">
          <span aria-hidden="true">⚠️</span>
          <span>
            {counts.urgent === 1 ? '1 Produkt muss jetzt weg' : `${counts.urgent} Produkte müssen jetzt weg`}
          </span>
        </div>
      )}

      {ablaufend.length > 0 && (
        <>
          <h2 className="section">Läuft ab</h2>
          <div className="card">
            {ablaufend.map(({ item, expiry }) => (
              <TapRow
                key={item.id}
                title={item.name}
                sub={item.bestBefore ? formatExpiry(item.bestBefore) : undefined}
                leading={<span className={`dot dot-${expiry.state}`} aria-hidden="true" />}
                onClick={() => onGo('vorrat')}
              />
            ))}
          </div>
        </>
      )}

      {shop.open > 0 && (
        <>
          <h2 className="section">Einkauf</h2>
          <button
            type="button"
            className="card pad"
            style={{ width: '100%', textAlign: 'left' }}
            onClick={() => onGo('einkauf')}
          >
            <div className="spread">
              <span style={{ fontWeight: 600 }}>
                {shop.open === 1 ? '1 Eintrag offen' : `${shop.open} Einträge offen`}
              </span>
              <IconChevron size={18} />
            </div>
          </button>
        </>
      )}

      {challenges.length > 0 && (
        <>
          <h2 className="section">Challenges</h2>
          <div className="stack">
            {challenges.slice(0, 3).map((challenge) => {
              const status = pace(challenge)
              const next = suggestSlot(challenge)
              return (
                <button
                  key={challenge.id}
                  type="button"
                  className="card pad"
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => onGo('sparen')}
                >
                  <div className="spread">
                    <span style={{ fontWeight: 600 }}>{challenge.name}</span>
                    <span className="row-value">{formatMoney(savedCents(challenge))}</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Bar percent={progress(challenge)} tone={status.onTrack ? undefined : 'warn'} />
                  </div>
                  <div className="small muted" style={{ marginTop: 5 }}>
                    {status.behind > 0
                      ? `${status.behind} ${status.behind === 1 ? 'Feld' : 'Felder'} nachzuholen`
                      : next !== null
                        ? `Als Nächstes Feld ${next + 1} · von ${formatMoney(totalCents(challenge))} insgesamt`
                        : 'alles erledigt'}
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {counts.low > 0 && (
        <>
          <h2 className="section">Geht zur Neige</h2>
          <button
            type="button"
            className="card pad"
            style={{ width: '100%', textAlign: 'left' }}
            onClick={() => onGo('vorrat')}
          >
            <div className="spread">
              <span>{counts.low === 1 ? '1 Produkt nachkaufen' : `${counts.low} Produkte nachkaufen`}</span>
              <IconChevron size={18} />
            </div>
          </button>
        </>
      )}

      {/* Am Ende, nicht oben: Wer schon Daten hat, will zuerst die Zahlen
          sehen. Danach ist der kurze Weg zum nächsten Handgriff willkommen. */}
      <h2 className="section">Schnell erfasst</h2>
      <div className="quick-tiles">
        <button type="button" className="quick-tile" onClick={() => onGo('geld', { compose: 'ausgabe' })}>
          <IconWallet size={20} />
          Ausgabe
        </button>
        <button type="button" className="quick-tile" onClick={() => onGo('einkauf')}>
          <IconCart size={20} />
          Einkauf
        </button>
        <button type="button" className="quick-tile" onClick={() => onGo('sparen')}>
          <IconTarget size={20} />
          Sparen
        </button>
      </div>

      {(!session || zugang === false) && (
        <div style={{ marginTop: 12 }}>
          <Entry
            emoji="☁️"
            title={session ? 'Noch nicht freigeschaltet' : 'Anmelden und sichern'}
            text={
              session
                ? 'Für die gemeinsame Einkaufsliste muss dich jemand freischalten.'
                : 'Daten auf allen Geräten, Einkaufsliste und Vorrat gemeinsam.'
            }
            onClick={onKonto}
          />
        </div>
      )}
    </div>
  )
}

/* --- Einstiegskarte -------------------------------------------------------- */

function Entry({
  emoji,
  title,
  text,
  onClick,
}: {
  emoji: string
  title: string
  text: string
  onClick: () => void
}) {
  return (
    <button type="button" className="entry" onClick={onClick}>
      <span className="entry-icon" aria-hidden="true">
        {emoji}
      </span>
      <span className="entry-main">
        <span className="entry-title">{title}</span>
        <span className="entry-text">{text}</span>
      </span>
      <span className="entry-go" aria-hidden="true">
        <IconChevron size={18} />
      </span>
    </button>
  )
}

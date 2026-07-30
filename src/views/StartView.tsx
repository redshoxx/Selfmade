import { useMemo } from 'react'
import { Bar, Empty, TapRow } from '../components/Bits'
import { IconChevron } from '../components/Icons'
import { isComplete, pace, progress, savedCents, suggestSlot, totalCents } from '../lib/challenges'
import { formatExpiry } from '../lib/date'
import { currentMonth, summarizeMonth, totalSaved } from '../lib/finance'
import { formatMoney, formatSigned } from '../lib/money'
import { entries as pantryEntries, needsAttention, pantryCounts, sortEntries } from '../lib/pantry'
import { shopCounts } from '../lib/shopping'
import { live } from '../lib/store'
import { useApp } from '../lib/useApp'
import type { Tab } from '../lib/types'

/**
 * Die Startseite.
 *
 * Sie beantwortet drei Fragen, ohne dass man tippen muss: Wie steht der Monat?
 * Muss zu Hause etwas weg? Was fehlt beim nächsten Einkauf? Alles Weitere ist
 * einen Reiter entfernt.
 */
export function StartView({ onGo }: { onGo: (tab: Tab) => void }) {
  const { state } = useApp()
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

  return (
    <div className="scroll">
      <div className="head">
        <h1>Hallo{state.settings.displayName !== 'Ich' ? ` ${state.settings.displayName}` : ''}</h1>
      </div>

      {nichtsLos ? (
        <Empty
          emoji="👋"
          title="Willkommen"
          text="Fang an, wo es dir am meisten bringt: eine Ausgabe erfassen, die Einkaufsliste füllen oder eine Spar-Challenge starten."
        />
      ) : (
        <>
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
                {counts.urgent === 1
                  ? '1 Produkt muss jetzt weg'
                  : `${counts.urgent} Produkte müssen jetzt weg`}
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
              <button type="button" className="card pad" style={{ width: '100%', textAlign: 'left' }} onClick={() => onGo('einkauf')}>
                <div className="spread">
                  <span style={{ fontWeight: 600 }}>
                    {shop.open === 1 ? '1 Eintrag offen' : `${shop.open} Einträge offen`}
                  </span>
                  <IconChevron size={18} />
                </div>
                {state.household && (
                  <div className="small muted" style={{ marginTop: 3 }}>
                    Geteilt mit {state.household.name}
                  </div>
                )}
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
                  <span>
                    {counts.low === 1 ? '1 Produkt nachkaufen' : `${counts.low} Produkte nachkaufen`}
                  </span>
                  <IconChevron size={18} />
                </div>
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}

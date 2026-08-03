import { useMemo } from 'react'
import { Bar } from '../components/Bits'
import { IconChevron, IconGear } from '../components/Icons'
import { Kopf, KopfKnopf } from '../components/Kopf'
import { isComplete, savedCents, suggestSlot, totalCents } from '../lib/challenges'
import { aisle } from '../lib/aisles'
import { expiryKurz, formatDayFull, today } from '../lib/date'
import { currentMonth, summarizeMonth, totalSaved } from '../lib/finance'
import { formatMoney, formatSigned } from '../lib/money'
import { entries as pantryEntries, needsAttention, pantryCounts, sortEntries } from '../lib/pantry'
import { shopCounts } from '../lib/shopping'
import { live } from '../lib/store'
import { useApp } from '../lib/useApp'
import type { GoIntent } from '../App'
import type { Challenge, Tab } from '../lib/types'

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
  onEinstellungen,
}: {
  onGo: (tab: Tab, intent?: GoIntent) => void
  onKonto: () => void
  /**
   * Das Zahnrad steht im Kopf dieser Ansicht, nicht mehr schwebend über allen.
   * Fest verankert lag es auf Vorrat und Notizen über der Schaltfläche rechts
   * oben – gemessen 12 Punkte Überlappung auf einem iPhone 12.
   */
  onEinstellungen: () => void
}) {
  const { state, session, zugang } = useApp()
  const month = currentMonth()

  const summary = useMemo(() => summarizeMonth(state, month), [state, month])
  const counts = pantryCounts(state)
  const shop = shopCounts(state)
  const gespart = totalSaved(state)

  const ablaufend = useMemo(
    () =>
      sortEntries(pantryEntries(state))
        .filter((e) => needsAttention(e.expiry.state))
        .slice(0, 3),
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
    challenges.length === 0 &&
    // Ohne das behauptete die Seite „hier ist noch nichts“, während im
    // Spar-Bereich ein Betrag stand.
    gespart === 0 &&
    live(state.notes).length === 0

  const name = state.settings.displayName
  const gruss = `Hallo${name !== 'Ich' ? ` ${name}` : ''}`
  const monatsName = MONATE[Number(month.split('-')[1]) - 1] ?? ''
  const zahnrad = (
    <KopfKnopf label="Einstellungen" onClick={onEinstellungen}>
      <IconGear size={20} />
    </KopfKnopf>
  )

  if (nichtsLos) {
    return (
      <>
        <Kopf ueberzeile={formatDayFull(today())} titel={gruss} aktionen={zahnrad} />

        <div className="scroll">
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
              onClick={() => onGo('geld', { challenge: true })}
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
      </>
    )
  }

  // Die Challenge, die als Nächstes dran ist – der Entwurf zeigt genau eine.
  const challenge = challenges[0]

  return (
    <>
      <Kopf ueberzeile={formatDayFull(today())} titel={gruss} aktionen={zahnrad} />

      <div className="scroll">
        {/* Die große Karte: die eine Zahl, wegen der man die App aufmacht. */}
        <button type="button" className="hero" onClick={() => onGo('geld')}>
          <div className="hero-kopf">
            <span className="hero-label">Bleibt diesen Monat</span>
            <span className="hero-neben">{monatsName}</span>
          </div>
          <div
            className="hero-zahl"
            style={{ color: summary.balanceCents < 0 ? 'var(--bad-text)' : undefined }}
          >
            {formatSigned(summary.balanceCents)}
          </div>
          {summary.incomeCents > 0 && (
            <div style={{ marginTop: 12 }}>
              <Bar
                percent={(summary.expenseCents / summary.incomeCents) * 100}
                tone={summary.expenseCents > summary.incomeCents ? 'bad' : undefined}
              />
            </div>
          )}
          <div className="hero-fuss">
            <span>{formatMoney(summary.incomeCents)} rein</span>
            <span>{formatMoney(summary.expenseCents)} raus</span>
          </div>
        </button>

        <div className="tiles" style={{ marginTop: 10 }}>
          <button type="button" className="tile" onClick={() => onGo('geld', { sparen: true })}>
            <div className="tile-label">Gespart</div>
            <div className="tile-value">{formatMoney(gespart)}</div>
          </button>
          <button type="button" className="tile" onClick={() => onGo('einkauf')}>
            <div className="tile-label">Einkauf offen</div>
            <div className="tile-value">
              {shop.open === 1 ? '1 Eintrag' : `${shop.open} Einträge`}
            </div>
          </button>
        </div>

        {ablaufend.length > 0 && (
          <>
            <h2 className="section">
              Läuft ab
              {counts.urgent > 0 && (
                <span className="section-zahl section-zahl-dringend">
                  {counts.urgent} dringend
                </span>
              )}
            </h2>
            <div className="card">
              {ablaufend.map(({ item, expiry }) => (
                <button
                  key={item.id}
                  type="button"
                  className="zeile"
                  onClick={() => onGo('vorrat')}
                >
                  <span className="zeile-kachel" data-stufe={expiry.state} aria-hidden="true">
                    {aisle(item.aisle).emoji}
                  </span>
                  <span className="zeile-haupt">
                    <span className="zeile-name">{item.name}</span>
                    <span className="zeile-sub">
                      {trimNumber(item.qty)} {item.unit}
                    </span>
                  </span>
                  <span className="etikett" data-stufe={expiry.state}>
                    {item.bestBefore ? expiryKurz(item.bestBefore) : aisle(item.aisle).name}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {challenge && (
          <>
            <h2 className="section">{challenge.name}</h2>
            <button
              type="button"
              className="card pad"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => onGo('geld', { sparen: true })}
            >
              <div className="spread" style={{ alignItems: 'baseline' }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{naechstesFeld(challenge)}</span>
                <span className="row-value">{formatMoney(savedCents(challenge))}</span>
              </div>
              <Segmente challenge={challenge} />
              <div className="small muted" style={{ marginTop: 8 }}>
                {challenge.filled.length} von {challenge.slots} Feldern · Ziel{' '}
                {formatMoney(totalCents(challenge))}
              </div>
            </button>
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

        {(!session || zugang === false) && (
          <div style={{ marginTop: 16 }}>
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
    </>
  )
}

/**
 * Ein Strich je Feld der Challenge.
 *
 * Bei 52 Wochen sieht man damit nicht nur *wie viel*, sondern *wie oft* – und
 * ein Loch in der Reihe fällt auf, wo ein durchgehender Balken nur etwas
 * kürzer wäre. Ab 60 Feldern werden die Striche schmaler als ein Gerätepixel;
 * dann fasst je Strich mehrere Felder zusammen.
 */
function Segmente({ challenge }: { challenge: Challenge }) {
  const striche = Math.min(challenge.slots, 52)
  const proStrich = challenge.slots / striche
  const gefuellt = new Set(challenge.filled)

  return (
    <div
      className="segmente"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={challenge.slots}
      aria-valuenow={challenge.filled.length}
      aria-label={`${challenge.filled.length} von ${challenge.slots} Feldern`}
    >
      {Array.from({ length: striche }, (_, i) => {
        const von = Math.round(i * proStrich)
        const bis = Math.round((i + 1) * proStrich)
        let voll = false
        for (let slot = von; slot < bis; slot++) if (gefuellt.has(slot)) voll = true
        return <span key={i} className={`segment${voll ? ' segment-voll' : ''}`} />
      })}
    </div>
  )
}

/** „2“ statt „2.0“, aber „1.5“ bleibt „1,5“. */
function trimNumber(value: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value)
}

const MONATE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

/** „Feld 22 ist dran“ – oder, wenn nichts offen ist, dass es das war. */
function naechstesFeld(challenge: Challenge): string {
  const next = suggestSlot(challenge)
  return next === null ? 'Alle Felder voll' : `Feld ${next + 1} ist dran`
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

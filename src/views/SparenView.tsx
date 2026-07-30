import { useMemo, useState } from 'react'
import { AmountField, Bar, Empty, Field, TapRow } from '../components/Bits'
import { IconChevron, IconPlus, IconTrash } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import {
  TEMPLATES,
  isComplete,
  pace,
  progress,
  remainingCents,
  savedCents,
  slots,
  suggestSlot,
  totalCents,
  type ChallengeTemplate,
} from '../lib/challenges'
import { today } from '../lib/date'
import { allPotStatus, potEntries, potStatus, totalSaved } from '../lib/finance'
import { formatMoney, formatShort } from '../lib/money'
import { tick } from '../lib/platform'
import { live } from '../lib/store'
import { useApp } from '../lib/useApp'
import type { Challenge, Pot } from '../lib/types'

/**
 * Sparen: Töpfe und Challenges.
 *
 * Eine Challenge ohne Spartopf wäre ein Spiel ohne Punktestand – deshalb legt
 * die App beim Anlegen gleich einen Topf mit an. Jedes Häkchen bewegt dann
 * echtes Geld, und der Fortschritt steht nicht nur im Raster, sondern auch im
 * Sparstand.
 */
export function SparenView({ startPicking }: { startPicking?: boolean }) {
  const { state } = useApp()
  const [openChallenge, setOpenChallenge] = useState<Challenge | null>(null)
  const [openPot, setOpenPot] = useState<Pot | null>(null)
  // Kommt man über den Einstieg auf der Startseite, steht die Auswahl gleich
  // offen – sonst wäre der Weg dorthin zwei Tipps lang statt einem.
  const [picking, setPicking] = useState(Boolean(startPicking))
  const [creatingPot, setCreatingPot] = useState(false)

  const challenges = useMemo(
    () => live(state.challenges).filter((c) => !c.archived),
    [state.challenges],
  )
  const pots = useMemo(() => allPotStatus(state), [state])
  const gesamt = totalSaved(state)

  return (
    <>
      <div className="scroll">
        <div className="head">
          <h1>Sparen</h1>
        </div>

        <div className="card pad" style={{ marginBottom: 12 }}>
          <div className="tile-label">Insgesamt gespart</div>
          <div className="big-money">{formatMoney(gesamt)}</div>
        </div>

        <h2 className="section">Challenges</h2>
        {challenges.length === 0 ? (
          <Empty
            emoji="🎯"
            title="Noch keine Challenge"
            text="Such dir eine aus – die 1-€-Challenge bringt in einem Jahr 1.378 € zusammen."
          />
        ) : (
          <div className="stack">
            {challenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onOpen={() => setOpenChallenge(challenge)}
              />
            ))}
          </div>
        )}

        <div className="btn-row">
          <button type="button" className="btn btn-primary btn-wide" onClick={() => setPicking(true)}>
            <IconPlus size={18} />
            Challenge starten
          </button>
        </div>

        <h2 className="section">Spartöpfe</h2>
        {pots.length === 0 ? (
          <p className="small muted" style={{ padding: '0 2px 8px' }}>
            Noch kein Topf. Beim Start einer Challenge legt die App einen an.
          </p>
        ) : (
          <div className="card">
            {pots.map((status) => (
              <TapRow
                key={status.pot.id}
                title={status.pot.name}
                sub={
                  status.pot.targetCents
                    ? `${status.progress} % von ${formatShort(status.pot.targetCents)}`
                    : 'ohne festes Ziel'
                }
                leading={
                  <span style={{ fontSize: 20 }} aria-hidden="true">
                    {status.pot.emoji}
                  </span>
                }
                value={formatMoney(status.savedCents)}
                onClick={() => setOpenPot(status.pot)}
              />
            ))}
          </div>
        )}

        <div className="btn-row">
          <button type="button" className="btn btn-wide" onClick={() => setCreatingPot(true)}>
            <IconPlus size={18} />
            Spartopf anlegen
          </button>
        </div>
      </div>

      {picking && <TemplateSheet onClose={() => setPicking(false)} />}
      {openChallenge && (
        <ChallengeSheet challenge={openChallenge} onClose={() => setOpenChallenge(null)} />
      )}
      {creatingPot && <PotSheet onClose={() => setCreatingPot(false)} />}
      {openPot && <PotSheet pot={openPot} onClose={() => setOpenPot(null)} />}
    </>
  )
}

/* --- Übersichtskarte ------------------------------------------------------- */

function ChallengeCard({ challenge, onOpen }: { challenge: Challenge; onOpen: () => void }) {
  const done = savedCents(challenge)
  const total = totalCents(challenge)
  const status = pace(challenge)
  const fertig = isComplete(challenge)

  return (
    <button type="button" className="card pad" onClick={onOpen} style={{ textAlign: 'left', width: '100%' }}>
      <div className="spread">
        <span style={{ fontWeight: 600 }}>{challenge.name}</span>
        <IconChevron size={18} />
      </div>
      <div className="spread" style={{ marginTop: 6, alignItems: 'flex-end' }}>
        <span className="big-money" style={{ fontSize: 26 }}>
          {formatMoney(done)}
        </span>
        <span className="small muted">von {formatShort(total)}</span>
      </div>
      <div style={{ marginTop: 9 }}>
        <Bar percent={progress(challenge)} tone={fertig ? 'good' : status.onTrack ? undefined : 'warn'} />
      </div>
      <div className="small muted" style={{ marginTop: 6 }}>
        {fertig ? (
          <span style={{ color: 'var(--good)' }}>Geschafft – alle Felder voll.</span>
        ) : status.behind > 0 ? (
          <span style={{ color: 'var(--warn)' }}>
            {status.behind} {status.behind === 1 ? 'Feld' : 'Felder'} offen aus der Vergangenheit
          </span>
        ) : (
          `${challenge.filled.length} von ${challenge.slots} Feldern · im Plan`
        )}
      </div>
    </button>
  )
}

/* --- Challenge auswählen --------------------------------------------------- */

function TemplateSheet({ onClose }: { onClose: () => void }) {
  const { dispatch } = useApp()
  const [custom, setCustom] = useState(false)

  const start = (template: ChallengeTemplate) => {
    // Topf und Challenge in einem Zug, damit die beiden verknüpft sind –
    // sonst bliebe jedes Häkchen folgenlos.
    dispatch({
      type: 'challenge/start',
      pot: {
        name: template.name,
        emoji: template.emoji,
        targetCents: totalCents(template),
        targetDate: null,
      },
      challenge: {
        name: template.name,
        kind: template.kind,
        stepCents: template.stepCents,
        slots: template.slots,
        unit: template.unit,
        startDate: today(),
        filled: [],
        archived: false,
      },
    })
    onClose()
  }

  if (custom) return <CustomChallengeSheet onClose={onClose} onBack={() => setCustom(false)} />

  return (
    <Sheet title="Challenge starten" onClose={onClose}>
      <div className="stack">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="card pad"
            style={{ textAlign: 'left', width: '100%' }}
            onClick={() => start(template)}
          >
            <div className="spread">
              <span style={{ fontWeight: 600 }}>
                <span aria-hidden="true">{template.emoji} </span>
                {template.name}
              </span>
              <span className="row-value">{formatShort(totalCents(template))}</span>
            </div>
            <div className="small muted" style={{ marginTop: 3 }}>
              {template.description}
            </div>
          </button>
        ))}
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn-wide" onClick={() => setCustom(true)}>
          Eigene Challenge
        </button>
      </div>

      <p className="small muted" style={{ marginTop: 12 }}>
        Zu jeder Challenge legt die App einen Spartopf an. Jedes abgehakte Feld zahlt dort ein.
      </p>
    </Sheet>
  )
}

function CustomChallengeSheet({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const { dispatch } = useApp()
  const [name, setName] = useState('Meine Challenge')
  const [stepCents, setStepCents] = useState<number | null>(100)
  const [slotCount, setSlotCount] = useState('52')
  const [kind, setKind] = useState<Challenge['kind']>('steigend')
  const [unit, setUnit] = useState<Challenge['unit']>('woche')

  const parsedSlots = Number(slotCount)
  const slotsValid = Number.isInteger(parsedSlots) && parsedSlots > 0 && parsedSlots <= 400
  const canSave = name.trim() !== '' && stepCents !== null && stepCents > 0 && slotsValid

  const vorschau = canSave
    ? totalCents({ kind, stepCents: stepCents!, slots: parsedSlots })
    : 0

  const save = () => {
    if (!canSave) return
    dispatch({
      type: 'challenge/start',
      pot: { name: name.trim(), emoji: '🎯', targetCents: vorschau, targetDate: null },
      challenge: {
        name: name.trim(),
        kind,
        stepCents: stepCents!,
        slots: parsedSlots,
        unit,
        startDate: today(),
        filled: [],
        archived: false,
      },
    })
    onClose()
  }

  return (
    <Sheet title="Eigene Challenge" onClose={onBack}>
      <Field label="Name">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <AmountField cents={stepCents} onChange={setStepCents} label="Schrittweite" />

      <div className="field-row">
        <Field label="Felder" error={slotsValid ? null : '1 bis 400.'}>
          <input
            className="input"
            inputMode="numeric"
            value={slotCount}
            onChange={(e) => setSlotCount(e.target.value)}
          />
        </Field>
        <Field label="Rhythmus">
          <select className="select" value={unit} onChange={(e) => setUnit(e.target.value as Challenge['unit'])}>
            <option value="tag">täglich</option>
            <option value="woche">wöchentlich</option>
            <option value="monat">monatlich</option>
          </select>
        </Field>
      </div>

      <span className="field-label">Art</span>
      <div className="segmented" style={{ marginBottom: 16 }}>
        <button type="button" aria-pressed={kind === 'steigend'} onClick={() => setKind('steigend')}>
          Steigend
        </button>
        <button type="button" aria-pressed={kind === 'gleich'} onClick={() => setKind('gleich')}>
          Gleich
        </button>
        <button type="button" aria-pressed={kind === 'frei'} onClick={() => setKind('frei')}>
          Frei
        </button>
      </div>

      {canSave && (
        <div className="notice notice-info">
          <span aria-hidden="true">∑</span>
          <span>Ergibt am Ende {formatMoney(vorschau)}</span>
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn btn-primary btn-wide" onClick={save} disabled={!canSave}>
          Starten
        </button>
      </div>
    </Sheet>
  )
}

/* --- Challenge-Raster ------------------------------------------------------ */

function ChallengeSheet({ challenge, onClose }: { challenge: Challenge; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const current = live(state.challenges).find((c) => c.id === challenge.id) ?? challenge
  const raster = useMemo(() => slots(current), [current])
  const suggested = suggestSlot(current)

  const toggle = (index: number) => {
    tick(state.settings.haptics)
    dispatch({ type: 'challenge/toggleSlot', id: current.id, slot: index })
  }

  return (
    <Sheet
      title={current.name}
      onClose={onClose}
      action={
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'challenge/remove', id: current.id })
            onClose()
          }}
          aria-label="Löschen"
          style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'var(--bad)' }}
        >
          <IconTrash />
        </button>
      }
    >
      <div className="spread" style={{ alignItems: 'flex-end', marginBottom: 8 }}>
        <span className="big-money">{formatMoney(savedCents(current))}</span>
        <span className="small muted">noch {formatMoney(remainingCents(current))}</span>
      </div>
      <Bar percent={progress(current)} tone={isComplete(current) ? 'good' : undefined} />

      <p className="small muted" style={{ margin: '10px 0 14px' }}>
        {current.kind === 'frei'
          ? 'Such dir ein Feld aus – die Reihenfolge ist dir überlassen.'
          : 'Tipp auf das Feld der laufenden Woche, sobald du das Geld zurückgelegt hast.'}
      </p>

      <div className="slots">
        {raster.map((slot) => {
          // Bei der 1-€-Challenge ist Feld 12 nun einmal 12 €. Die Zahl dann
          // zweimal übereinander zu stellen, sieht nach Fehler aus.
          const numberSaysSame = slot.cents === (slot.index + 1) * 100
          return (
            <button
              key={slot.index}
              type="button"
              className={[
                'slot',
                slot.filled ? 'slot-on' : '',
                slot.overdue ? 'slot-overdue' : '',
                !slot.filled && slot.index === suggested ? 'slot-suggested' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => toggle(slot.index)}
              aria-pressed={slot.filled}
              aria-label={`Feld ${slot.index + 1}, ${formatMoney(slot.cents)}${slot.filled ? ', erledigt' : ''}`}
            >
              {!numberSaysSame && (
                <span className="slot-num" aria-hidden="true">
                  {slot.index + 1}
                </span>
              )}
              <span className="slot-amount" aria-hidden="true">
                {shortAmount(slot.cents)}
              </span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

/** „12“ statt „12,00 €“ – im Raster zählt jede Stelle. */
function shortAmount(cents: number): string {
  if (cents % 100 === 0) return String(cents / 100)
  return (cents / 100).toFixed(2).replace('.', ',')
}

/* --- Spartopf -------------------------------------------------------------- */

function PotSheet({ pot, onClose }: { pot?: Pot; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const current = pot ? live(state.pots).find((p) => p.id === pot.id) ?? pot : undefined

  const [name, setName] = useState(current?.name ?? '')
  const [emoji, setEmoji] = useState(current?.emoji ?? '🎯')
  const [targetCents, setTargetCents] = useState<number | null>(current?.targetCents ?? null)
  const [depositCents, setDepositCents] = useState<number | null>(null)

  const status = current ? potStatus(state, current) : null
  const history = current ? potEntries(state, current.id) : []
  const canSave = name.trim() !== ''

  const save = () => {
    if (!canSave) return
    const payload = { name: name.trim(), emoji, targetCents, targetDate: null }
    if (current) dispatch({ type: 'pot/update', id: current.id, patch: payload })
    else dispatch({ type: 'pot/add', pot: payload })
    onClose()
  }

  const deposit = (sign: 1 | -1) => {
    if (!current || depositCents === null || depositCents <= 0) return
    dispatch({
      type: 'potEntry/add',
      entry: {
        potId: current.id,
        cents: sign * depositCents,
        date: today(),
        note: '',
        challengeId: null,
        slot: null,
      },
    })
    setDepositCents(null)
  }

  return (
    <Sheet
      title={current ? current.name : 'Spartopf anlegen'}
      onClose={onClose}
      action={
        current && (
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'pot/remove', id: current.id })
              onClose()
            }}
            aria-label="Löschen"
            style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'var(--bad)' }}
          >
            <IconTrash />
          </button>
        )
      }
    >
      {status && (
        <>
          <div className="spread" style={{ alignItems: 'flex-end', marginBottom: 8 }}>
            <span className="big-money">{formatMoney(status.savedCents)}</span>
            {status.remainingCents !== null && (
              <span className="small muted">noch {formatMoney(status.remainingCents)}</span>
            )}
          </div>
          {current?.targetCents && <Bar percent={status.progress} tone={status.reached ? 'good' : undefined} />}

          <div style={{ marginTop: 16 }}>
            <AmountField cents={depositCents} onChange={setDepositCents} label="Ein- oder auszahlen" />
            <div className="btn-row" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => deposit(1)}
                disabled={depositCents === null || depositCents <= 0}
              >
                Einzahlen
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => deposit(-1)}
                disabled={depositCents === null || depositCents <= 0}
              >
                Entnehmen
              </button>
            </div>
          </div>
        </>
      )}

      <h2 className="section">Einstellungen</h2>
      <div className="field-row">
        <Field label="Zeichen">
          <input
            className="input"
            value={emoji}
            onChange={(event) => setEmoji(event.target.value.slice(0, 2))}
            style={{ textAlign: 'center', fontSize: 22 }}
          />
        </Field>
        <div style={{ flex: 3 }}>
          <Field label="Name">
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
        </div>
      </div>

      <AmountField cents={targetCents} onChange={setTargetCents} label="Ziel (freiwillig)" />

      <div className="btn-row">
        <button type="button" className="btn btn-primary btn-wide" onClick={save} disabled={!canSave}>
          Speichern
        </button>
      </div>

      {history.length > 0 && (
        <>
          <h2 className="section">Bewegungen</h2>
          <div className="card">
            {history.slice(0, 20).map((entry) => (
              <TapRow
                key={entry.id}
                title={entry.note || (entry.cents > 0 ? 'Einzahlung' : 'Entnahme')}
                sub={entry.date}
                value={
                  <span className={entry.cents > 0 ? 'plus' : undefined}>
                    {entry.cents > 0 ? '+' : '−'}
                    {formatMoney(Math.abs(entry.cents))}
                  </span>
                }
              />
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}

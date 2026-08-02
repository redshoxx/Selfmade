import { useMemo, useState } from 'react'
import { AmountField, Bar, Empty, Field, TapRow } from '../components/Bits'
import { IconPlus, IconTrash } from '../components/Icons'
import { Kopf } from '../components/Kopf'
import { Sheet } from '../components/Sheet'
import { SparenBereich } from './SparenBereich'
import { addMonths, formatDayLong, formatMonth, today } from '../lib/date'
import {
  budgetStatus,
  currentMonth,
  frequentCategories,
  groupByDay,
  summarizeMonth,
  totalsByCategory,
  txsInMonth,
} from '../lib/finance'
import { formatMoney, formatSigned } from '../lib/money'
import { live } from '../lib/store'
import { useApp } from '../lib/useApp'
import { useUndo } from '../lib/useUndo'
import { UndoBar } from '../components/Undo'
import type { Tx, TxKind } from '../lib/types'
import { KategorienSheet } from './KategorienSheet'
import { WiederkehrendSheet } from './WiederkehrendSheet'

/**
 * Geld: was rein- und rausgeht, und was liegen bleibt.
 *
 * Oben steht, was der Monat übrig lässt – die einzige Zahl, die die meisten
 * täglich sehen wollen. Darunter die Buchungen nach Tag, weil man sich an
 * Ausgaben über den Tag erinnert, nicht über die Kategorie.
 *
 * Seit dem Umbau steckt auch das Sparen hier, als zweiter Bereich hinter einem
 * Umschalter. Es war ein eigener Reiter, und auf einem 390 Punkte breiten
 * iPhone sind fünf davon die Grenze – die Notizen brauchten den Platz mehr.
 * Sachlich gehört es ohnehin hierher: Was man zurücklegt, ist das, was der
 * Monat übrig gelassen hat.
 */
export function GeldView({
  startCompose,
  startBereich = 'monat',
  startPicking,
}: {
  startCompose?: TxKind | null
  startBereich?: 'monat' | 'sparen'
  startPicking?: boolean
}) {
  const { state, dispatch } = useApp()
  const { undo, dismiss, remove } = useUndo(dispatch)
  const [bereich, setBereich] = useState<'monat' | 'sparen'>(startBereich)
  const [month, setMonth] = useState(currentMonth())
  const [compose, setCompose] = useState<TxKind | null>(startCompose ?? null)
  const [edit, setEdit] = useState<Tx | null>(null)
  const [managing, setManaging] = useState(false)
  const [recurring, setRecurring] = useState(false)

  const summary = useMemo(() => summarizeMonth(state, month), [state, month])
  const days = useMemo(() => groupByDay(txsInMonth(state, month)), [state, month])
  const budgets = useMemo(() => budgetStatus(state, month), [state, month])
  // „Wofür“ zeigt nur, was nicht schon unter „Budgets“ steht. Beide Blöcke
  // untereinander mit denselben Kategorien zu füllen, liest sich wie ein
  // Fehler – so ergänzen sie sich: oben die überwachten, darunter der Rest.
  const spending = useMemo(() => {
    const withBudget = new Set(budgets.map((b) => b.category.id))
    return totalsByCategory(state, month, 'ausgabe').filter(
      (entry) => !entry.category || !withBudget.has(entry.category.id),
    )
  }, [state, month, budgets])

  const isCurrent = month === currentMonth()

  return (
    <>
      <Kopf
        titel="Geld"
        aktionen={
          bereich === 'monat' && (
            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setMonth(addMonths(month, -1))}
                aria-label="Vorheriger Monat"
                style={{ padding: '0 8px', minHeight: 40 }}
              >
                ‹
              </button>
              <span className="kopf-beiwerk" style={{ minWidth: '8ch', textAlign: 'center' }}>
                {formatMonth(month)}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setMonth(addMonths(month, 1))}
                aria-label="Nächster Monat"
                disabled={isCurrent}
                style={{ padding: '0 8px', minHeight: 40 }}
              >
                ›
              </button>
            </div>
          )
        }
      />

      <div className="scroll">
        <div className="segmented" style={{ marginBottom: 14 }}>
          <button
            type="button"
            aria-pressed={bereich === 'monat'}
            onClick={() => setBereich('monat')}
          >
            Monat
          </button>
          <button
            type="button"
            aria-pressed={bereich === 'sparen'}
            onClick={() => setBereich('sparen')}
          >
            Sparen
          </button>
        </div>

        {bereich === 'sparen' ? (
          <SparenBereich startPicking={startPicking} />
        ) : (
          <>
            <div className="card pad" style={{ marginBottom: 12 }}>
              <div className="tile-label">Bleibt übrig</div>
              <div
                className="big-money"
                style={{
                  color: summary.balanceCents < 0 ? 'var(--bad)' : 'var(--text)',
                }}
              >
                {formatSigned(summary.balanceCents)}
              </div>
              <div className="spread small muted" style={{ marginTop: 10 }}>
                <span>Rein {formatMoney(summary.incomeCents)}</span>
                <span>Raus {formatMoney(summary.expenseCents)}</span>
              </div>
              {summary.incomeCents > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Bar
                    percent={(summary.expenseCents / summary.incomeCents) * 100}
                    tone={summary.expenseCents > summary.incomeCents ? 'bad' : undefined}
                  />
                </div>
              )}
            </div>

            <div className="btn-row" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCompose('ausgabe')}
              >
                <IconPlus size={18} />
                Ausgabe
              </button>
              <button type="button" className="btn" onClick={() => setCompose('einnahme')}>
                <IconPlus size={18} />
                Einnahme
              </button>
            </div>

            {budgets.length > 0 && (
              <>
                {/* Überzogenes steht oben – `budgetStatus` sortiert nach
                Auslastung, das Dringendste kommt also von selbst zuerst. */}
                <h2 className="section">Budgets</h2>
                <div className="card">
                  {budgets.map((b) => (
                    <div
                      key={b.category.id}
                      className="row"
                      style={{ display: 'block', padding: 14 }}
                    >
                      <div className="spread">
                        <span className="row-title">
                          <span aria-hidden="true">{b.category.emoji} </span>
                          {b.category.name}
                        </span>
                        <span
                          className="row-value"
                          style={{ color: b.over ? 'var(--bad)' : undefined }}
                        >
                          {formatMoney(b.spentCents)}
                        </span>
                      </div>
                      <div style={{ marginTop: 7 }}>
                        <Bar
                          percent={b.usedPercent}
                          tone={b.over ? 'bad' : b.usedPercent >= 80 ? 'warn' : 'good'}
                        />
                      </div>
                      <div className="small muted" style={{ marginTop: 5 }}>
                        {b.over
                          ? `${formatMoney(b.spentCents - b.budgetCents)} über dem Budget`
                          : `noch ${formatMoney(b.budgetCents - b.spentCents)} von ${formatMoney(b.budgetCents)}`}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {spending.length > 0 && (
              <>
                <h2 className="section">{budgets.length > 0 ? 'Wofür sonst' : 'Wofür'}</h2>
                <div className="card">
                  {spending.slice(0, 6).map((entry) => (
                    <div
                      key={entry.category?.id ?? 'ohne'}
                      className="row"
                      style={{ display: 'block', padding: 12 }}
                    >
                      <div className="spread">
                        <span className="row-title">
                          <span aria-hidden="true">{entry.category?.emoji ?? '❓'} </span>
                          {entry.category?.name ?? 'Ohne Kategorie'}
                        </span>
                        <span className="row-value">{formatMoney(entry.cents)}</span>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <Bar percent={entry.share} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="btn-row">
              <button type="button" className="btn" onClick={() => setManaging(true)}>
                Kategorien
              </button>
              <button type="button" className="btn" onClick={() => setRecurring(true)}>
                Wiederkehrend
              </button>
            </div>

            <h2 className="section">Buchungen</h2>
            {days.length === 0 ? (
              <Empty
                emoji="🧾"
                title="Nichts erfasst"
                text={
                  isCurrent
                    ? 'Trag deine erste Ausgabe ein – zwei Tipps, fertig.'
                    : `Im ${formatMonth(month)} ist nichts eingetragen.`
                }
              />
            ) : (
              days.map((day) => (
                <section key={day.date}>
                  <h2 className="section" style={{ marginTop: 16 }}>
                    {formatDayLong(day.date)}
                    <span className="muted"> · {formatSigned(day.netCents)}</span>
                  </h2>
                  <div className="card">
                    {day.txs.map((tx) => {
                      const category = state.categories.find((c) => c.id === tx.categoryId)
                      return (
                        <TapRow
                          key={tx.id}
                          title={category?.name ?? 'Ohne Kategorie'}
                          sub={tx.note || undefined}
                          leading={
                            <span style={{ fontSize: 20 }} aria-hidden="true">
                              {category?.emoji ?? '💸'}
                            </span>
                          }
                          value={
                            <span className={tx.kind === 'einnahme' ? 'plus' : undefined}>
                              {tx.kind === 'einnahme' ? '+' : '−'}
                              {formatMoney(tx.cents)}
                            </span>
                          }
                          onClick={() => setEdit(tx)}
                        />
                      )
                    })}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </div>

      <UndoBar state={undo} onDismiss={dismiss} />

      {managing && <KategorienSheet onClose={() => setManaging(false)} />}
      {recurring && <WiederkehrendSheet onClose={() => setRecurring(false)} />}
      {compose && <TxSheet kind={compose} onClose={() => setCompose(null)} />}
      {edit && (
        <TxSheet
          tx={edit}
          kind={edit.kind}
          onClose={() => setEdit(null)}
          onDelete={() => {
            remove('txs', edit.id, { type: 'tx/remove', id: edit.id }, 'Buchung gelöscht')
            setEdit(null)
          }}
        />
      )}
    </>
  )
}

/* --- Erfassen -------------------------------------------------------------- */

function TxSheet({
  tx,
  kind,
  onClose,
  onDelete,
}: {
  tx?: Tx
  kind: TxKind
  onClose: () => void
  /** Läuft über die Ansicht, weil nur dort der Rückgängig-Streifen lebt. */
  onDelete?: () => void
}) {
  const { state, dispatch } = useApp()
  const current = tx ? (live(state.txs).find((t) => t.id === tx.id) ?? tx) : undefined

  const [txKind, setTxKind] = useState<TxKind>(current?.kind ?? kind)
  const [cents, setCents] = useState<number | null>(current?.cents ?? null)
  const [categoryId, setCategoryId] = useState(current?.categoryId ?? '')
  const [note, setNote] = useState(current?.note ?? '')
  const [date, setDate] = useState(current?.date ?? today())

  const categories = useMemo(() => frequentCategories(state, txKind, 99), [state, txKind])
  // Beim Wechsel zwischen Einnahme und Ausgabe passt die alte Kategorie nicht
  // mehr; dann still auf die erste passende zurückfallen.
  const effectiveCategory = categories.some((c) => c.id === categoryId)
    ? categoryId
    : (categories[0]?.id ?? '')

  const canSave = cents !== null && cents > 0 && effectiveCategory !== ''

  const save = () => {
    if (!canSave) return
    const payload = {
      kind: txKind,
      cents: cents!,
      categoryId: effectiveCategory,
      note: note.trim(),
      date,
      recurring: current?.recurring ?? false,
    }
    if (current) dispatch({ type: 'tx/update', id: current.id, patch: payload })
    else dispatch({ type: 'tx/add', tx: payload })
    onClose()
  }

  return (
    <Sheet
      title={current ? 'Buchung' : txKind === 'ausgabe' ? 'Ausgabe' : 'Einnahme'}
      onClose={onClose}
      action={
        current &&
        onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Löschen"
            style={{
              width: 40,
              height: 40,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--bad)',
            }}
          >
            <IconTrash />
          </button>
        )
      }
    >
      <div className="segmented" style={{ marginBottom: 16 }}>
        <button
          type="button"
          aria-pressed={txKind === 'ausgabe'}
          onClick={() => setTxKind('ausgabe')}
        >
          Ausgabe
        </button>
        <button
          type="button"
          aria-pressed={txKind === 'einnahme'}
          onClick={() => setTxKind('einnahme')}
        >
          Einnahme
        </button>
      </div>

      <AmountField cents={cents} onChange={setCents} autoFocus={!current} />

      <span className="field-label">Kategorie</span>
      <div className="chips">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`chip${effectiveCategory === category.id ? ' chip-on' : ''}`}
            onClick={() => setCategoryId(category.id)}
          >
            <span aria-hidden="true">{category.emoji}</span>
            {category.name}
          </button>
        ))}
      </div>

      <Field label="Notiz (freiwillig)">
        <input
          className="input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="z. B. Wocheneinkauf"
          autoCapitalize="sentences"
        />
      </Field>

      <Field label="Datum">
        <input
          className="input"
          type="date"
          value={date}
          min="2000-01-01"
          max="2100-12-31"
          onChange={(event) => event.target.value && setDate(event.target.value)}
        />
      </Field>

      <div className="btn-row">
        <button
          type="button"
          className="btn btn-primary btn-wide"
          onClick={save}
          disabled={!canSave}
        >
          Speichern
        </button>
      </div>
    </Sheet>
  )
}

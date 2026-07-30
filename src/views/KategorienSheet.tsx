import { useMemo, useState } from 'react'
import { AmountField, Bar, Field, TapRow } from '../components/Bits'
import { IconChevron, IconPlus, IconTrash } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { budgetStatus, currentMonth } from '../lib/finance'
import { formatMoney } from '../lib/money'
import { useApp } from '../lib/useApp'
import type { Category, TxKind } from '../lib/types'

/**
 * Kategorien und ihre Monatsbudgets.
 *
 * Ein Budget ist hier kein Verbot, sondern eine Markierung: Die App sagt, wie
 * weit der Monat schon aufgebraucht ist, und meldet sich, wenn es darüber
 * hinausgeht. Gebucht wird trotzdem – wer an der Kasse steht, ist mit einer
 * Sperre nicht geholfen.
 */

/** Vorschläge zum Antippen, damit niemand die Emoji-Tastatur suchen muss. */
const EMOJI_VORSCHLAEGE: Record<TxKind, readonly string[]> = {
  ausgabe: ['🛒', '🏠', '🚌', '🎬', '💊', '🔁', '👕', '🍽️', '⛽', '🐈', '🎁', '📚', '💇', '🏋️', '✈️', '➖'],
  einnahme: ['💼', '🧰', '🎁', '📈', '🏦', '💸', '🧾', '➕'],
}

export function KategorienSheet({ onClose }: { onClose: () => void }) {
  const { state } = useApp()
  const [kind, setKind] = useState<TxKind>('ausgabe')
  const [edit, setEdit] = useState<Category | null>(null)
  const [creating, setCreating] = useState(false)

  const month = currentMonth()
  const budgets = useMemo(() => budgetStatus(state, month), [state, month])
  const shown = state.categories.filter((c) => c.kind === kind)

  // Die letzte ihrer Art lässt sich nicht löschen – sonst könnte man nichts
  // mehr erfassen. Das steht auch im Bearbeiten-Blatt.
  const isLast = shown.length <= 1

  return (
    <>
      <Sheet title="Kategorien" onClose={onClose}>
        <div className="segmented" style={{ marginBottom: 16 }}>
          <button type="button" aria-pressed={kind === 'ausgabe'} onClick={() => setKind('ausgabe')}>
            Ausgaben
          </button>
          <button type="button" aria-pressed={kind === 'einnahme'} onClick={() => setKind('einnahme')}>
            Einnahmen
          </button>
        </div>

        <div className="card">
          {shown.map((category) => {
            const status = budgets.find((b) => b.category.id === category.id)
            return (
              <TapRow
                key={category.id}
                title={category.name}
                sub={
                  status
                    ? `${formatMoney(status.spentCents)} von ${formatMoney(status.budgetCents)}`
                    : category.kind === 'ausgabe'
                      ? 'kein Budget'
                      : undefined
                }
                leading={
                  <span style={{ fontSize: 20 }} aria-hidden="true">
                    {category.emoji}
                  </span>
                }
                value={
                  status ? (
                    <span style={{ color: status.over ? 'var(--bad)' : undefined }}>
                      {status.usedPercent} %
                    </span>
                  ) : undefined
                }
                trailing={<IconChevron size={18} />}
                onClick={() => setEdit(category)}
              />
            )
          })}
        </div>

        {kind === 'ausgabe' && budgets.length > 0 && (
          <>
            <h2 className="section">Diesen Monat</h2>
            <div className="card">
              {budgets.map((b) => (
                <div key={b.category.id} className="row" style={{ display: 'block', padding: 12 }}>
                  <div className="spread">
                    <span className="row-title">
                      <span aria-hidden="true">{b.category.emoji} </span>
                      {b.category.name}
                    </span>
                    <span className="row-value" style={{ color: b.over ? 'var(--bad)' : undefined }}>
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
                      : `noch ${formatMoney(b.budgetCents - b.spentCents)} übrig`}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="btn-row">
          <button type="button" className="btn btn-primary btn-wide" onClick={() => setCreating(true)}>
            <IconPlus size={18} />
            Kategorie anlegen
          </button>
        </div>

        <p className="small muted" style={{ marginTop: 14 }}>
          Ein Budget gilt je Monat und nur für Ausgaben. Überschritten wird trotzdem gebucht – die
          App sagt nur Bescheid.
        </p>
      </Sheet>

      {creating && <CategorySheet kind={kind} onClose={() => setCreating(false)} />}
      {edit && <CategorySheet category={edit} kind={edit.kind} isLast={isLast} onClose={() => setEdit(null)} />}
    </>
  )
}

/* --- Anlegen und Bearbeiten ----------------------------------------------- */

function CategorySheet({
  category,
  kind,
  isLast,
  onClose,
}: {
  category?: Category
  kind: TxKind
  isLast?: boolean
  onClose: () => void
}) {
  const { state, dispatch } = useApp()
  const current = category ? state.categories.find((c) => c.id === category.id) ?? category : undefined

  const [name, setName] = useState(current?.name ?? '')
  const [emoji, setEmoji] = useState(current?.emoji ?? EMOJI_VORSCHLAEGE[kind][0]!)
  const [budgetCents, setBudgetCents] = useState<number | null>(current?.budgetCents ?? null)

  const canSave = name.trim().length > 0

  const save = () => {
    if (!canSave) return
    const payload = {
      name: name.trim(),
      emoji: emoji.trim() || '•',
      kind,
      // Ein Budget ergibt nur bei Ausgaben Sinn; bei Einnahmen zählt nichts
      // dagegen, es stünde für immer bei null Prozent.
      budgetCents: kind === 'ausgabe' && budgetCents !== null && budgetCents > 0 ? budgetCents : null,
    }
    if (current) dispatch({ type: 'category/update', id: current.id, patch: payload })
    else dispatch({ type: 'category/add', category: payload })
    onClose()
  }

  return (
    <Sheet
      title={current ? 'Kategorie' : 'Kategorie anlegen'}
      onClose={onClose}
      action={
        current &&
        !isLast && (
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'category/remove', id: current.id })
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
      <div className="field-row">
        <Field label="Zeichen">
          <input
            className="input"
            value={emoji}
            onChange={(event) => setEmoji(event.target.value.slice(0, 2))}
            style={{ textAlign: 'center', fontSize: 22 }}
            aria-label="Zeichen der Kategorie"
          />
        </Field>
        <div style={{ flex: 3 }}>
          <Field label="Name">
            <input
              className="input"
              value={name}
              autoFocus={!current}
              onChange={(event) => setName(event.target.value)}
              placeholder={kind === 'ausgabe' ? 'z. B. Haustier' : 'z. B. Nebenjob'}
              autoCapitalize="sentences"
            />
          </Field>
        </div>
      </div>

      <div className="chips">
        {EMOJI_VORSCHLAEGE[kind].map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className={`chip${emoji === suggestion ? ' chip-on' : ''}`}
            onClick={() => setEmoji(suggestion)}
            aria-label={`Zeichen ${suggestion}`}
            style={{ fontSize: 19, padding: '0 12px' }}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {kind === 'ausgabe' && (
        <div style={{ marginTop: 16 }}>
          <AmountField cents={budgetCents} onChange={setBudgetCents} label="Monatsbudget (freiwillig)" />
          <p className="small muted" style={{ marginTop: -6 }}>
            {budgetCents === null || budgetCents <= 0
              ? 'Ohne Budget wird nichts überwacht.'
              : `Die App meldet sich, sobald ${formatMoney(budgetCents)} im Monat überschritten sind.`}
          </p>
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn btn-primary btn-wide" onClick={save} disabled={!canSave}>
          Speichern
        </button>
      </div>

      {current && isLast && (
        <p className="small muted" style={{ marginTop: 14 }}>
          Das ist die letzte Kategorie dieser Art – sie bleibt erhalten, damit du weiter{' '}
          {kind === 'ausgabe' ? 'Ausgaben' : 'Einnahmen'} erfassen kannst.
        </p>
      )}

      {current && !isLast && (
        <p className="small muted" style={{ marginTop: 14 }}>
          Beim Löschen bleiben deine Buchungen erhalten; sie stehen danach unter „Ohne Kategorie“.
        </p>
      )}
    </Sheet>
  )
}

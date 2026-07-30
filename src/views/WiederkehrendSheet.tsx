import { useMemo, useState } from 'react'
import { AmountField, Empty, Field, TapRow } from '../components/Bits'
import { IconPlus, IconTrash } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { formatDayShort, today } from '../lib/date'
import { frequentCategories } from '../lib/finance'
import { formatMoney } from '../lib/money'
import { describeRule, nextDate } from '../lib/recurring'
import { live } from '../lib/store'
import { useApp } from '../lib/useApp'
import type { RecurringTx, RecurringUnit, TxKind } from '../lib/types'

/**
 * Wiederkehrende Buchungen.
 *
 * Miete, Abos, Gehalt – einmal angelegt, danach von selbst. Die Regel ist
 * keine Buchung; sie erzeugt beim Öffnen der App die Buchungen, die seit dem
 * letzten Mal fällig geworden sind.
 */
export function WiederkehrendSheet({ onClose }: { onClose: () => void }) {
  const { state } = useApp()
  const [edit, setEdit] = useState<RecurringTx | null>(null)
  const [creating, setCreating] = useState(false)

  const rules = useMemo(() => live(state.recurringTxs), [state.recurringTxs])

  return (
    <>
      <Sheet title="Wiederkehrend" onClose={onClose}>
        {rules.length === 0 ? (
          <Empty
            emoji="🔁"
            title="Nichts Wiederkehrendes"
            text="Miete, Abos oder Gehalt einmal anlegen – danach bucht die App sie von selbst."
          />
        ) : (
          <div className="card">
            {rules.map((rule) => {
              const category = state.categories.find((c) => c.id === rule.categoryId)
              const next = nextDate(rule)
              return (
                <TapRow
                  key={rule.id}
                  title={rule.note || category?.name || 'Buchung'}
                  sub={
                    rule.active
                      ? `${describeRule(rule)}${next ? ` · wieder am ${formatDayShort(next)}` : ''}`
                      : 'pausiert'
                  }
                  leading={
                    <span style={{ fontSize: 20, opacity: rule.active ? 1 : 0.4 }} aria-hidden="true">
                      {category?.emoji ?? '🔁'}
                    </span>
                  }
                  value={
                    <span className={rule.kind === 'einnahme' ? 'plus' : undefined}>
                      {rule.kind === 'einnahme' ? '+' : '−'}
                      {formatMoney(rule.cents)}
                    </span>
                  }
                  onClick={() => setEdit(rule)}
                />
              )
            })}
          </div>
        )}

        <div className="btn-row">
          <button type="button" className="btn btn-primary btn-wide" onClick={() => setCreating(true)}>
            <IconPlus size={18} />
            Wiederkehrendes anlegen
          </button>
        </div>

        <p className="small muted" style={{ marginTop: 14 }}>
          Fällige Buchungen legt die App beim Öffnen an – auch rückwirkend, wenn du länger nicht
          hier warst. Doppelt wird nie gebucht.
        </p>
      </Sheet>

      {creating && <RuleSheet onClose={() => setCreating(false)} />}
      {edit && <RuleSheet rule={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

/* --- Anlegen und Bearbeiten ----------------------------------------------- */

function RuleSheet({ rule, onClose }: { rule?: RecurringTx; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const current = rule ? live(state.recurringTxs).find((r) => r.id === rule.id) ?? rule : undefined

  const [kind, setKind] = useState<TxKind>(current?.kind ?? 'ausgabe')
  const [cents, setCents] = useState<number | null>(current?.cents ?? null)
  const [note, setNote] = useState(current?.note ?? '')
  const [unit, setUnit] = useState<RecurringUnit>(current?.unit ?? 'monat')
  const [anchorDay, setAnchorDay] = useState(String(current?.anchorDay ?? 1))
  const [startDate, setStartDate] = useState(current?.startDate ?? today())
  const [categoryId, setCategoryId] = useState(current?.categoryId ?? '')
  const [active, setActive] = useState(current?.active ?? true)

  const categories = useMemo(() => frequentCategories(state, kind, 99), [state, kind])
  const effectiveCategory = categories.some((c) => c.id === categoryId)
    ? categoryId
    : categories[0]?.id ?? ''

  const parsedDay = Number(anchorDay)
  const dayValid = Number.isInteger(parsedDay) && parsedDay >= 1 && parsedDay <= 31
  const canSave = cents !== null && cents > 0 && effectiveCategory !== '' && (unit !== 'monat' || dayValid)

  const save = () => {
    if (!canSave) return
    const payload = {
      kind,
      cents: cents!,
      categoryId: effectiveCategory,
      note: note.trim(),
      unit,
      anchorDay: unit === 'monat' ? parsedDay : Number(startDate.slice(-2)),
      anchorMonth: unit === 'jahr' ? Number(startDate.slice(5, 7)) : null,
      startDate,
      // Beim Bearbeiten bleibt stehen, was schon gebucht wurde – sonst
      // entstünden dieselben Buchungen ein zweites Mal.
      lastRun: current?.lastRun ?? null,
      active,
    }
    if (current) dispatch({ type: 'recurring/update', id: current.id, patch: payload })
    else dispatch({ type: 'recurring/add', rule: payload })
    onClose()
  }

  return (
    <Sheet
      title={current ? 'Wiederkehrend' : 'Neu anlegen'}
      onClose={onClose}
      action={
        current && (
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'recurring/remove', id: current.id })
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
      <div className="segmented" style={{ marginBottom: 16 }}>
        <button type="button" aria-pressed={kind === 'ausgabe'} onClick={() => setKind('ausgabe')}>
          Ausgabe
        </button>
        <button type="button" aria-pressed={kind === 'einnahme'} onClick={() => setKind('einnahme')}>
          Einnahme
        </button>
      </div>

      <AmountField cents={cents} onChange={setCents} autoFocus={!current} />

      <Field label="Bezeichnung">
        <input
          className="input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={kind === 'ausgabe' ? 'z. B. Miete' : 'z. B. Gehalt'}
          autoCapitalize="sentences"
        />
      </Field>

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

      <span className="field-label" style={{ marginTop: 16 }}>
        Rhythmus
      </span>
      <div className="segmented" style={{ marginBottom: 14 }}>
        <button type="button" aria-pressed={unit === 'woche'} onClick={() => setUnit('woche')}>
          Wöchentlich
        </button>
        <button type="button" aria-pressed={unit === 'monat'} onClick={() => setUnit('monat')}>
          Monatlich
        </button>
        <button type="button" aria-pressed={unit === 'jahr'} onClick={() => setUnit('jahr')}>
          Jährlich
        </button>
      </div>

      {unit === 'monat' && (
        <Field label="Tag im Monat" error={dayValid ? null : 'Ein Tag zwischen 1 und 31.'}>
          <input
            className="input"
            inputMode="numeric"
            value={anchorDay}
            onChange={(event) => setAnchorDay(event.target.value)}
          />
        </Field>
      )}

      {unit === 'monat' && parsedDay >= 29 && dayValid && (
        <p className="small muted" style={{ marginTop: -6, marginBottom: 14 }}>
          In kurzen Monaten wird am letzten Tag gebucht – den {parsedDay}. gibt es nicht überall.
        </p>
      )}

      <Field label={unit === 'woche' ? 'Erster Termin (legt den Wochentag fest)' : 'Beginnt am'}>
        <input
          className="input"
          type="date"
          value={startDate}
          min="2000-01-01"
          max="2100-12-31"
          onChange={(event) => event.target.value && setStartDate(event.target.value)}
        />
      </Field>

      <button
        type="button"
        className={`chip${active ? ' chip-on' : ''}`}
        onClick={() => setActive(!active)}
        aria-pressed={active}
      >
        {active ? 'Aktiv' : 'Pausiert'}
      </button>

      <div className="btn-row">
        <button type="button" className="btn btn-primary btn-wide" onClick={save} disabled={!canSave}>
          Speichern
        </button>
      </div>

      {!current && (
        <p className="small muted" style={{ marginTop: 12 }}>
          Liegt der Beginn in der Vergangenheit, holt die App alle fälligen Buchungen nach.
        </p>
      )}
    </Sheet>
  )
}

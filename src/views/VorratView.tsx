import { useMemo, useState } from 'react'
import { Empty, Field, TapRow } from '../components/Bits'
import { IconPlus, IconTrash } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { AISLES, aisle, guessAisle } from '../lib/aisles'
import { formatExpiry, today } from '../lib/date'
import {
  entries as pantryEntries,
  filterEntries,
  pantryCounts,
  sortEntries,
  type PantryFilter,
} from '../lib/pantry'
import { live } from '../lib/store'
import { useApp } from '../lib/useApp'
import type { AisleId, PantryItem } from '../lib/types'

/**
 * Der Vorrat zu Hause.
 *
 * Der eigentliche Zweck steht ganz oben: Was läuft ab? Alles andere – Bestände,
 * Mindestmengen – ist Beiwerk, das erst hilft, wenn die Liste gepflegt ist.
 */

const FILTERS: { id: PantryFilter; label: string }[] = [
  { id: 'ablauf', label: 'Läuft ab' },
  { id: 'nachkaufen', label: 'Nachkaufen' },
  { id: 'alle', label: 'Alles' },
]

export function VorratView({ startFilter }: { startFilter?: PantryFilter }) {
  const { state } = useApp()
  const [filter, setFilter] = useState<PantryFilter>(startFilter ?? 'ablauf')
  const [open, setOpen] = useState<PantryItem | null>(null)
  const [creating, setCreating] = useState(false)

  const counts = pantryCounts(state)
  const all = useMemo(() => pantryEntries(state), [state])
  const shown = useMemo(() => sortEntries(filterEntries(all, filter)), [all, filter])

  // Kein Vorrat angelegt: Ein Filter über nichts wäre nur verwirrend.
  const empty = all.length === 0

  return (
    <>
      <div className="scroll">
        <div className="head">
          <h1>Vorrat</h1>
          <button type="button" className="btn btn-ghost" onClick={() => setCreating(true)}>
            <IconPlus size={18} />
            Anlegen
          </button>
        </div>

        {counts.urgent > 0 && (
          <div className="notice notice-bad">
            <span aria-hidden="true">⚠️</span>
            <span>
              {counts.urgent === 1
                ? '1 Produkt ist abgelaufen oder muss heute weg'
                : `${counts.urgent} Produkte sind abgelaufen oder müssen jetzt weg`}
            </span>
          </div>
        )}

        {!empty && (
          <div className="segmented" style={{ marginBottom: 14 }}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {empty ? (
          <Empty
            emoji="🧊"
            title="Noch nichts im Vorrat"
            text="Trag ein, was du zu Hause hast – dann meldet sich die App, bevor etwas abläuft."
          />
        ) : shown.length === 0 ? (
          <Empty
            emoji="👌"
            title={filter === 'ablauf' ? 'Nichts läuft ab' : 'Nichts fehlt'}
            text={filter === 'ablauf' ? 'Alle Mindesthaltbarkeitsdaten sind in Ordnung.' : undefined}
          />
        ) : (
          <div className="card">
            {shown.map(({ item, expiry, low }) => (
              <TapRow
                key={item.id}
                title={item.name}
                sub={
                  <>
                    {item.bestBefore ? formatExpiry(item.bestBefore) : aisle(item.aisle).name}
                    {low && ' · nachkaufen'}
                  </>
                }
                value={`${trimNumber(item.qty)} ${item.unit}`}
                leading={<span className={`dot dot-${expiry.state}`} aria-hidden="true" />}
                onClick={() => setOpen(item)}
              />
            ))}
          </div>
        )}

        {!empty && (
          <div className="btn-row">
            <button type="button" className="btn btn-wide" onClick={() => setCreating(true)}>
              <IconPlus size={18} />
              Produkt anlegen
            </button>
          </div>
        )}
      </div>

      {creating && <PantrySheet onClose={() => setCreating(false)} />}
      {open && <PantrySheet item={open} onClose={() => setOpen(null)} />}
    </>
  )
}

/** „2“ statt „2.0“, aber „1.5“ bleibt „1,5“. */
function trimNumber(value: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value)
}

/* --- Anlegen und Bearbeiten ----------------------------------------------- */

function PantrySheet({ item, onClose }: { item?: PantryItem; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const current = item ? live(state.pantryItems).find((i) => i.id === item.id) ?? item : undefined

  const [name, setName] = useState(current?.name ?? '')
  const [qty, setQty] = useState(String(current?.qty ?? 1))
  const [unit, setUnit] = useState(current?.unit ?? 'Stück')
  const [minQty, setMinQty] = useState(String(current?.minQty ?? 0))
  const [bestBefore, setBestBefore] = useState(current?.bestBefore ?? '')
  const [aisleId, setAisleId] = useState<AisleId>(current?.aisle ?? 'sonstiges')
  // Solange niemand die Abteilung von Hand gewählt hat, folgt sie dem Namen.
  const [aisleTouched, setAisleTouched] = useState(Boolean(current))

  const parsedQty = Number(qty.replace(',', '.'))
  const parsedMin = Number(minQty.replace(',', '.'))
  const qtyValid = Number.isFinite(parsedQty) && parsedQty >= 0
  const minValid = Number.isFinite(parsedMin) && parsedMin >= 0
  const canSave = name.trim().length > 0 && qtyValid && minValid

  const save = () => {
    if (!canSave) return
    const payload = {
      name: name.trim(),
      aisle: aisleId,
      qty: parsedQty,
      unit: unit.trim() || 'Stück',
      minQty: parsedMin,
      bestBefore: bestBefore || null,
    }
    if (current) dispatch({ type: 'pantry/update', id: current.id, patch: payload })
    else dispatch({ type: 'pantry/add', item: payload })
    onClose()
  }

  return (
    <Sheet
      title={current ? 'Produkt' : 'Produkt anlegen'}
      onClose={onClose}
      action={
        current && (
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'pantry/remove', id: current.id })
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
      <Field label="Name">
        <input
          className="input"
          value={name}
          autoFocus={!current}
          onChange={(event) => {
            setName(event.target.value)
            if (!aisleTouched) setAisleId(guessAisle(event.target.value))
          }}
          placeholder="z. B. Milch"
          autoCapitalize="sentences"
        />
      </Field>

      <div className="field-row">
        <Field label="Menge" error={qtyValid ? null : 'Bitte eine Zahl.'}>
          <input
            className="input"
            inputMode="decimal"
            value={qty}
            onChange={(event) => setQty(event.target.value)}
          />
        </Field>
        <Field label="Einheit">
          <input
            className="input"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="Stück"
            autoCapitalize="none"
          />
        </Field>
      </div>

      <Field label="Mindesthaltbar bis">
        <input
          className="input"
          type="date"
          value={bestBefore}
          min="2000-01-01"
          max="2100-12-31"
          onChange={(event) => setBestBefore(event.target.value)}
        />
      </Field>

      {bestBefore && (
        <p className="small muted" style={{ marginTop: -6, marginBottom: 14 }}>
          {formatExpiry(bestBefore, today())} · gewarnt wird nach den Fristen für{' '}
          {aisle(aisleId).name.toLowerCase()}
        </p>
      )}

      <Field
        label="Nachkaufen ab (0 = nie erinnern)"
        error={minValid ? null : 'Bitte eine Zahl.'}
      >
        <input
          className="input"
          inputMode="decimal"
          value={minQty}
          onChange={(event) => setMinQty(event.target.value)}
        />
      </Field>

      <span className="field-label">Abteilung</span>
      <div className="chips">
        {AISLES.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`chip${aisleId === a.id ? ' chip-on' : ''}`}
            onClick={() => {
              setAisleId(a.id)
              setAisleTouched(true)
            }}
          >
            <span aria-hidden="true">{a.emoji}</span>
            {a.name}
          </button>
        ))}
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn-primary btn-wide" onClick={save} disabled={!canSave}>
          Speichern
        </button>
      </div>
    </Sheet>
  )
}

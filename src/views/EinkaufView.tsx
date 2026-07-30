import { useMemo, useRef, useState } from 'react'
import { Bar, Empty, Field, TapRow } from '../components/Bits'
import { IconCheck, IconPlus, IconTrash } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { AISLES, aisle, guessAisle } from '../lib/aisles'
import { restockSuggestions } from '../lib/pantry'
import { tick } from '../lib/platform'
import { findExisting, groupForShopping, observedOrder, shopCounts, suggestions } from '../lib/shopping'
import { live } from '../lib/store'
import { useApp } from '../lib/useApp'
import type { AisleId, ShopItem } from '../lib/types'

/**
 * Die Einkaufsliste.
 *
 * Zwei Dinge entscheiden hier über den Nutzen: Etwas draufzuschreiben muss ein
 * Handgriff sein, und im Laden muss die Reihenfolge stimmen. Alles andere ist
 * nachgeordnet.
 */
export function EinkaufView() {
  const { state, dispatch } = useApp()
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState<ShopItem | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const groups = useMemo(() => groupForShopping(state, { includeDone: true }), [state])
  const counts = shopCounts(state)
  const restock = useMemo(() => restockSuggestions(state), [state])
  const hints = useMemo(() => suggestions(state, draft, 5), [state, draft])

  const add = (name: string) => {
    const clean = name.trim()
    if (!clean) return

    // Steht es schon drauf, wird es nicht doppelt angelegt, sondern nur wieder
    // geöffnet. Zwei Menschen denken oft an dasselbe.
    const existing = findExisting(state, clean)
    if (existing) {
      if (existing.done) dispatch({ type: 'shop/toggle', id: existing.id })
      setDraft('')
      input.current?.focus()
      return
    }

    dispatch({
      type: 'shop/add',
      item: {
        name: clean,
        qty: '',
        aisle: guessAisle(clean),
        done: false,
        addedBy: state.settings.displayName,
        pantryId: null,
      },
    })
    setDraft('')
    // Fokus bleibt im Feld: Wer eine Liste tippt, tippt selten nur eine Zeile.
    input.current?.focus()
  }

  const toggle = (item: ShopItem) => {
    tick(state.settings.haptics)
    dispatch({ type: 'shop/toggle', id: item.id })
  }

  const finishTrip = () => {
    // Das Abhaken hat verraten, in welcher Reihenfolge die Abteilungen kamen.
    dispatch({ type: 'shop/finishTrip', order: observedOrder(state.shopItems) })
  }

  return (
    <>
      <div className="scroll">
        <div className="head">
          <h1>Einkauf</h1>
          <span className="head-sub">
            {counts.open > 0 ? `${counts.open} offen` : counts.total > 0 ? 'alles erledigt' : ''}
          </span>
        </div>

        {counts.total > 0 && counts.done > 0 && (
          <div style={{ marginBottom: 14 }}>
            <Bar percent={(counts.done / counts.total) * 100} tone="good" />
          </div>
        )}

        {state.household && (
          <div className="notice notice-info">
            <span aria-hidden="true">👥</span>
            <span>
              Geteilt mit {state.household.name}
              {state.household.members.length > 1 && ` · ${state.household.members.length} Personen`}
            </span>
          </div>
        )}

        {restock.length > 0 && (
          <>
            <h2 className="section">Geht zu Hause zur Neige</h2>
            <div className="chips">
              {restock.slice(0, 8).map(({ item }) => (
                <button
                  key={item.id}
                  type="button"
                  className="chip"
                  onClick={() =>
                    dispatch({
                      type: 'shop/add',
                      item: {
                        name: item.name,
                        qty: '',
                        aisle: item.aisle,
                        done: false,
                        addedBy: state.settings.displayName,
                        pantryId: item.id,
                      },
                    })
                  }
                >
                  <IconPlus size={15} />
                  {item.name}
                </button>
              ))}
            </div>
          </>
        )}

        {groups.length === 0 ? (
          <Empty
            emoji="🛒"
            title="Die Liste ist leer"
            text="Schreib unten hin, was fehlt. Die Abteilung erkennt die App selbst."
          />
        ) : (
          groups.map((group) => (
            <section key={group.aisle.id}>
              <h2 className="section">
                <span aria-hidden="true">{group.aisle.emoji} </span>
                {group.aisle.name}
                {group.openCount > 0 && <span className="muted"> · {group.openCount}</span>}
              </h2>
              <div className="card">
                {group.items.map((item) => (
                  <TapRow
                    key={item.id}
                    title={item.name}
                    sub={
                      [item.qty, item.addedBy && item.addedBy !== state.settings.displayName ? item.addedBy : '']
                        .filter(Boolean)
                        .join(' · ') || undefined
                    }
                    done={item.done}
                    leading={
                      <span
                        className="check-hit"
                        onClick={(event) => {
                          // Der Kreis hakt ab, der Rest der Zeile öffnet die
                          // Einzelheiten – zwei Ziele in einer Zeile.
                          event.stopPropagation()
                          toggle(item)
                        }}
                        role="checkbox"
                        aria-checked={item.done}
                        aria-label={`${item.name} abhaken`}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === ' ' || event.key === 'Enter') {
                            event.preventDefault()
                            toggle(item)
                          }
                        }}
                      >
                        <span className={`check${item.done ? ' check-on' : ''}`}>
                          <IconCheck size={15} />
                        </span>
                      </span>
                    }
                    onClick={() => setOpen(item)}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        {counts.done > 0 && (
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => dispatch({ type: 'shop/clearDone' })}>
              Erledigte entfernen
            </button>
            <button type="button" className="btn btn-primary" onClick={finishTrip}>
              Einkauf fertig
            </button>
          </div>
        )}

        {counts.done > 0 && (
          <p className="small muted" style={{ marginTop: 10, textAlign: 'center' }}>
            „Einkauf fertig“ merkt sich nebenbei die Reihenfolge der Abteilungen in deinem Laden.
          </p>
        )}
      </div>

      {/* Erfassen unten: dort, wo der Daumen ohnehin liegt. */}
      <div className="quick">
        <input
          ref={input}
          className="input"
          placeholder="Was fehlt?"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add(draft)
            }
          }}
          enterKeyHint="done"
          autoCapitalize="sentences"
          autoComplete="off"
          aria-label="Neuer Eintrag"
        />
        <button
          type="button"
          className="quick-add"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          aria-label="Hinzufügen"
        >
          <IconPlus size={22} />
        </button>
      </div>

      {draft.trim().length > 0 && hints.length > 0 && (
        <div className="chips" style={{ padding: '0 16px 10px', margin: 0 }}>
          {hints.map((name) => (
            <button key={name} type="button" className="chip" onClick={() => add(name)}>
              {name}
            </button>
          ))}
        </div>
      )}

      {open && <ItemSheet item={open} onClose={() => setOpen(null)} />}
    </>
  )
}

/* --- Einzelheiten eines Eintrags ------------------------------------------ */

function ItemSheet({ item, onClose }: { item: ShopItem; onClose: () => void }) {
  const { state, dispatch } = useApp()
  // Aus dem Zustand lesen, nicht aus der Übergabe: Ändert die andere Person
  // etwas, während das Blatt offen ist, steht hier der neue Stand.
  const current = live(state.shopItems).find((i) => i.id === item.id) ?? item
  const [name, setName] = useState(current.name)
  const [qty, setQty] = useState(current.qty)

  const save = (patch: Partial<ShopItem>) => dispatch({ type: 'shop/update', id: item.id, patch })

  return (
    <Sheet
      title="Eintrag"
      onClose={onClose}
      action={
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'shop/remove', id: item.id })
            onClose()
          }}
          aria-label="Löschen"
          style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'var(--bad)' }}
        >
          <IconTrash />
        </button>
      }
    >
      <Field label="Name">
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => name.trim() && save({ name: name.trim() })}
          autoCapitalize="sentences"
        />
      </Field>

      <Field label="Menge (frei)">
        <input
          className="input"
          value={qty}
          onChange={(event) => setQty(event.target.value)}
          onBlur={() => save({ qty: qty.trim() })}
          placeholder="z. B. 2 Packungen"
          autoCapitalize="none"
        />
      </Field>

      <span className="field-label">Abteilung</span>
      <div className="chips">
        {AISLES.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`chip${current.aisle === a.id ? ' chip-on' : ''}`}
            onClick={() => save({ aisle: a.id as AisleId })}
          >
            <span aria-hidden="true">{a.emoji}</span>
            {a.name}
          </button>
        ))}
      </div>

      <p className="small muted" style={{ marginTop: 12 }}>
        In {aisle(current.aisle).name} einsortiert
        {current.addedBy && ` · aufgeschrieben von ${current.addedBy}`}
      </p>
    </Sheet>
  )
}

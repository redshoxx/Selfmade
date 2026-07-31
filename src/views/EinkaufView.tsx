import { useMemo, useRef, useState } from 'react'
import { AmountField, Bar, Empty, Field } from '../components/Bits'
import { IconCheck, IconClose, IconPlus, IconTrash } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { UndoBar } from '../components/Undo'
import { AISLES, aisle, guessAisle } from '../lib/aisles'
import { formatMoney } from '../lib/money'
import { restockSuggestions } from '../lib/pantry'
import { tick } from '../lib/platform'
import { bumpQuantity, isBumpable, mergeQuantities, parseEntry } from '../lib/quantity'
import { findExisting, groupForShopping, shopCounts, suggestions } from '../lib/shopping'
import { live } from '../lib/store'
import { useApp } from '../lib/useApp'
import { useSwipeToDelete } from '../lib/useSwipe'
import { useUndo } from '../lib/useUndo'
import type { AisleId, ShopItem } from '../lib/types'
import { NotizenView } from './NotizenView'
import { VorlagenSheet } from './VorlagenSheet'
import { AbschlussSheet } from './AbschlussSheet'

/**
 * Die Einkaufsliste.
 *
 * Zwei Dinge entscheiden über den Nutzen: Etwas draufzuschreiben muss ein
 * Handgriff sein, und im Laden muss die Reihenfolge stimmen. Alles Weitere –
 * Preise, Notizen, Vorlagen – ist freiwillig und darf diesen Handgriff nie
 * verlangsamen.
 */

/** Ab so vielen Einträgen lohnt ein Suchfeld; davor kostet es nur Platz. */
const SUCHE_AB = 12

export function EinkaufView() {
  const { state, dispatch, session, zugang } = useApp()
  const [bereich, setBereich] = useState<'liste' | 'notizen'>('liste')
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<ShopItem | null>(null)
  const [pricing, setPricing] = useState<ShopItem | null>(null)
  const [templates, setTemplates] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const { undo, dismiss, remove } = useUndo(dispatch)

  const counts = shopCounts(state)
  const restock = useMemo(() => restockSuggestions(state), [state])
  const hints = useMemo(() => suggestions(state, draft, 5), [state, draft])

  const groups = useMemo(() => {
    const all = groupForShopping(state, { includeDone: true })
    const needle = query.trim().toLowerCase()
    if (!needle) return all
    return all
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.name.toLowerCase().includes(needle)),
      }))
      .filter((group) => group.items.length > 0)
  }, [state, query])

  /**
   * Etwas auf die Liste setzen.
   *
   * Menge und Name kommen aus einem Feld: „2 Milch“ genügt. Steht die Ware
   * schon drauf, werden die Mengen zusammengezählt – zwei Zeilen „Milch“
   * helfen im Laden niemandem.
   */
  const add = (raw: string) => {
    const { name, qty } = parseEntry(raw)
    if (!name) return

    const existing = findExisting(state, name)
    if (existing) {
      dispatch({
        type: 'shop/update',
        id: existing.id,
        patch: {
          qty: mergeQuantities(existing.qty, qty),
          // Was schon eingekauft war, wird durch das erneute Aufschreiben
          // wieder offen – sonst bliebe es unter den erledigten stehen.
          done: false,
        },
      })
      setDraft('')
      input.current?.focus()
      return
    }

    dispatch({
      type: 'shop/add',
      item: {
        name,
        qty,
        aisle: guessAisle(name),
        done: false,
        addedBy: state.settings.displayName,
        pantryId: null,
        note: '',
        priceCents: null,
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

  if (bereich === 'notizen') {
    return <NotizenView onBack={() => setBereich('liste')} />
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

        <div className="segmented" style={{ marginBottom: 14 }}>
          <button type="button" aria-pressed onClick={() => setBereich('liste')}>
            Liste
          </button>
          <button type="button" aria-pressed={false} onClick={() => setBereich('notizen')}>
            Notizen
            {live(state.notes).length > 0 && (
              <span className="muted"> · {live(state.notes).length}</span>
            )}
          </button>
        </div>

        {counts.total > 0 && counts.done > 0 && (
          <div style={{ marginBottom: 14 }}>
            <Bar percent={(counts.done / counts.total) * 100} tone="good" />
          </div>
        )}

        {/* Nur der Ausnahmefall bekommt einen Hinweis. Dass die Liste geteilt
            ist, ist der Normalzustand – ein Banner auf jedem Bildschirm, das
            „alles in Ordnung“ meldet, liest nach zwei Tagen niemand mehr. */}
        {(!session || zugang === false) && (
          <div className="notice notice-warn">
            <span aria-hidden="true">!</span>
            <span>
              {session
                ? 'Diese Liste liegt nur auf diesem Gerät. Lass dich unter Zahnrad → Konto freischalten.'
                : 'Nur auf diesem Gerät. Melde dich unter Zahnrad → Konto an, dann seht ihr dieselbe Liste.'}
            </span>
          </div>
        )}

        {counts.total >= SUCHE_AB && (
          <div className="search">
            <input
              className="input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Auf der Liste suchen"
              aria-label="Auf der Liste suchen"
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setQuery('')}
                aria-label="Suche leeren"
              >
                <IconClose size={18} />
              </button>
            )}
          </div>
        )}

        {restock.length > 0 && !query && (
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
                        note: '',
                        priceCents: null,
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
          query ? (
            <Empty emoji="🔍" title="Nichts gefunden" text={`„${query}“ steht nicht auf der Liste.`} />
          ) : (
            <Empty
              emoji="🛒"
              title="Die Liste ist leer"
              text="Schreib unten hin, was fehlt – „2 Milch“ genügt. Die Abteilung erkennt die App selbst."
            />
          )
        ) : (
          groups.map((group) => (
            <section key={group.aisle.id}>
              <div className="aisle-head">
                <span aria-hidden="true">{group.aisle.emoji}</span>
                <span>{group.aisle.name}</span>
                {group.openCount > 0 && <span className="aisle-head-count">{group.openCount}</span>}
              </div>
              <div className="card">
                {group.items.map((item) => (
                  <ShopRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggle(item)}
                    onOpen={() => setOpen(item)}
                    onPrice={() => setPricing(item)}
                    onDelete={() =>
                      remove('shopItems', item.id, { type: 'shop/remove', id: item.id }, `„${item.name}“ gelöscht`)
                    }
                  />
                ))}
              </div>
            </section>
          ))
        )}

        <div className="btn-row">
          <button type="button" className="btn btn-wide" onClick={() => setTemplates(true)}>
            Vorlagen
          </button>
        </div>

        {counts.done > 0 && (
          <>
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => dispatch({ type: 'shop/clearDone' })}>
                Erledigte entfernen
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setFinishing(true)}>
                Einkauf fertig
              </button>
            </div>
            <p className="small muted" style={{ marginTop: 10, textAlign: 'center' }}>
              „Einkauf fertig“ merkt sich nebenbei die Reihenfolge der Abteilungen in deinem Laden.
            </p>
          </>
        )}
      </div>

      {/* Erfassen unten: dort, wo der Daumen ohnehin liegt. */}
      <div className="quick">
        <input
          ref={input}
          className="input"
          placeholder="Was fehlt? z. B. 2 Milch"
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

      <UndoBar state={undo} onDismiss={dismiss} />

      {open && (
        <ItemSheet
          item={open}
          onClose={() => setOpen(null)}
          onDelete={() => {
            remove('shopItems', open.id, { type: 'shop/remove', id: open.id }, `„${open.name}“ gelöscht`)
            setOpen(null)
          }}
        />
      )}
      {pricing && <PreisSheet item={pricing} onClose={() => setPricing(null)} />}
      {templates && <VorlagenSheet onClose={() => setTemplates(false)} />}
      {finishing && <AbschlussSheet onClose={() => setFinishing(false)} />}
    </>
  )
}

/* --- Eine Zeile ------------------------------------------------------------ */

function ShopRow({
  item,
  onToggle,
  onOpen,
  onPrice,
  onDelete,
}: {
  item: ShopItem
  onToggle: () => void
  onOpen: () => void
  onPrice: () => void
  onDelete: () => void
}) {
  const { state, dispatch } = useApp()
  const [stepping, setStepping] = useState(false)
  const swipe = useSwipeToDelete(onDelete)

  const bump = (delta: number) => {
    dispatch({ type: 'shop/update', id: item.id, patch: { qty: bumpQuantity(item.qty, delta) } })
  }

  const fremd = item.addedBy && item.addedBy !== state.settings.displayName
  const sub = [item.note, fremd ? item.addedBy : ''].filter(Boolean).join(' · ')

  return (
    <div className="swipe">
      <span className="swipe-hint" aria-hidden="true">
        <IconTrash size={20} />
      </span>
      <div
        className="swipe-row"
        style={{
          transform: `translateX(${swipe.offset}px)`,
          transition: swipe.offset === 0 ? 'transform 0.18s ease-out' : 'none',
        }}
        {...swipe.handlers}
      >
        <div className={`row${item.done ? ' row-done' : ''}${sub ? '' : ' row-tight'}`}>
          <span
            className="check-hit"
            onClick={(event) => {
              // Der Kreis hakt ab, der Rest der Zeile öffnet die Einzelheiten.
              event.stopPropagation()
              onToggle()
            }}
            role="checkbox"
            aria-checked={item.done}
            aria-label={`${item.name} abhaken`}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault()
                onToggle()
              }
            }}
          >
            <span className={`check${item.done ? ' check-on' : ''}`}>
              <IconCheck size={15} />
            </span>
          </span>

          <button
            type="button"
            className="row-main"
            onClick={onOpen}
            style={{ background: 'none', textAlign: 'left' }}
          >
            <span className="row-title">{item.name}</span>
            {sub && <span className="row-sub">{sub}</span>}
          </button>

          {/* Ist der Eintrag abgehakt, tritt die Menge zurück und der Preis
              nach vorn – im Wagen zählt, was es gekostet hat. */}
          {item.done ? (
            <button
              type="button"
              className={`price-add${item.priceCents !== null ? ' price-set' : ''}`}
              onClick={onPrice}
              aria-label={`Preis für ${item.name}`}
            >
              {item.priceCents !== null ? formatMoney(item.priceCents) : '+ €'}
            </button>
          ) : stepping && isBumpable(item.qty) ? (
            <span className="qty-step">
              <button type="button" onClick={() => bump(-1)} aria-label="Menge verringern">
                −
              </button>
              <span className="qty" onClick={() => setStepping(false)}>
                {item.qty || '1'}
              </span>
              <button type="button" onClick={() => bump(1)} aria-label="Menge erhöhen">
                +
              </button>
            </span>
          ) : (
            <button
              type="button"
              className={`qty${item.qty ? '' : ' qty-empty'}`}
              onClick={() => (isBumpable(item.qty) ? setStepping(true) : onOpen())}
              aria-label={item.qty ? `Menge ${item.qty} ändern` : 'Menge festlegen'}
            >
              {item.qty || '+'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* --- Preis nachtragen ------------------------------------------------------ */

function PreisSheet({ item, onClose }: { item: ShopItem; onClose: () => void }) {
  const { dispatch } = useApp()
  const [cents, setCents] = useState<number | null>(item.priceCents)

  const save = () => {
    dispatch({ type: 'shop/update', id: item.id, patch: { priceCents: cents } })
    onClose()
  }

  return (
    <Sheet title={item.name} onClose={onClose}>
      <AmountField cents={cents} onChange={setCents} autoFocus label="Preis" />
      <p className="small muted" style={{ marginTop: -6 }}>
        Beim Abschließen des Einkaufs wird die Summe aller Preise als Ausgabe gebucht.
      </p>
      <div className="btn-row">
        <button type="button" className="btn btn-primary btn-wide" onClick={save}>
          Übernehmen
        </button>
      </div>
      {item.priceCents !== null && (
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-wide"
            onClick={() => {
              dispatch({ type: 'shop/update', id: item.id, patch: { priceCents: null } })
              onClose()
            }}
          >
            Preis entfernen
          </button>
        </div>
      )}
    </Sheet>
  )
}

/* --- Einzelheiten eines Eintrags ------------------------------------------ */

function ItemSheet({
  item,
  onClose,
  onDelete,
}: {
  item: ShopItem
  onClose: () => void
  /**
   * Das Löschen läuft bewusst über die Ansicht statt hier: Nur dort lebt der
   * Rückgängig-Streifen. Ein Blatt, das selbst löscht, nimmt dem Griff den Weg
   * zurück – und danebengetippt ist auf dem Telefon schnell.
   */
  onDelete: () => void
}) {
  const { state, dispatch } = useApp()
  // Aus dem Zustand lesen, nicht aus der Übergabe: Ändert die andere Person
  // etwas, während das Blatt offen ist, steht hier der neue Stand.
  const current = live(state.shopItems).find((i) => i.id === item.id) ?? item
  const [name, setName] = useState(current.name)
  const [qty, setQty] = useState(current.qty)
  const [note, setNote] = useState(current.note)

  const save = (patch: Partial<ShopItem>) => dispatch({ type: 'shop/update', id: item.id, patch })

  return (
    <Sheet
      title="Eintrag"
      onClose={onClose}
      action={
        <button
          type="button"
          onClick={onDelete}
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

      <Field label="Menge">
        <input
          className="input"
          value={qty}
          onChange={(event) => setQty(event.target.value)}
          onBlur={() => save({ qty: qty.trim() })}
          placeholder="z. B. 2 oder 500 g"
          autoCapitalize="none"
        />
      </Field>

      <Field label="Notiz">
        <input
          className="input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => save({ note: note.trim() })}
          placeholder="z. B. die im blauen Karton"
          autoCapitalize="sentences"
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

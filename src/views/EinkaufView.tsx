import { useMemo, useRef, useState } from 'react'
import { AmountField, Bar, Empty, Field } from '../components/Bits'
import { IconCheck, IconClose, IconPlus, IconTemplate, IconTrash } from '../components/Icons'
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
import { ImLadenView } from './ImLadenView'
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
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<ShopItem | null>(null)
  const [pricing, setPricing] = useState<ShopItem | null>(null)
  const [templates, setTemplates] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [erledigteOffen, setErledigteOffen] = useState(false)
  const [imLaden, setImLaden] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const { undo, dismiss, remove } = useUndo(dispatch)

  const counts = shopCounts(state)
  const restock = useMemo(() => restockSuggestions(state), [state])
  const hints = useMemo(() => suggestions(state, draft, 5), [state, draft])

  const passt = (item: ShopItem, needle: string) =>
    !needle || item.name.toLowerCase().includes(needle)

  /*
   * Nur das Offene steht in den Abteilungen.
   *
   * Vorher mischte sich Abgehaktes darunter – am Ende eines Wocheneinkaufs
   * standen dreißig durchgestrichene Zeilen zwischen den fünf, die noch
   * fehlen. Erledigtes sammelt sich jetzt unten in einem Block, der zu ist,
   * bis man ihn aufmacht.
   */
  const groups = useMemo(() => {
    const all = groupForShopping(state)
    const needle = query.trim().toLowerCase()
    if (!needle) return all
    return all
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => passt(item, needle)),
      }))
      .filter((group) => group.items.length > 0)
  }, [state, query])

  // Was im Wagen zusammenkommt – steht neben „Im Wagen“, damit man die Summe
  // sieht, ohne den Block aufzuklappen.
  const wagenSumme = useMemo(
    () => live(state.shopItems).filter((i) => i.done).reduce((s, i) => s + (i.priceCents ?? 0), 0),
    [state.shopItems],
  )

  const erledigte = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return live(state.shopItems)
      .filter((item) => item.done && passt(item, needle))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [state.shopItems, query])

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

  if (imLaden) {
    return (
      <ImLadenView
        onBeenden={() => setImLaden(false)}
        onFertig={() => {
          setImLaden(false)
          setFinishing(true)
        }}
      />
    )
  }

  return (
    <>
      <div className="kopf kopf-spalte">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <h1 className="kopf-titel" style={{ flex: 1 }}>
            Einkauf
          </h1>
          <button type="button" className="kopf-pille" onClick={() => setTemplates(true)}>
            <IconTemplate size={16} />
            Vorlagen
          </button>
          {/* Nur wenn etwas offen ist: Ein Rundgang durch eine leere Liste
              führt zu nichts. */}
          {counts.open > 0 && (
            <button
              type="button"
              className="kopf-pille kopf-pille-voll"
              onClick={() => setImLaden(true)}
            >
              Im Laden
            </button>
          )}
        </div>

        {counts.total > 0 && (
          <div className="kopf-fortschritt">
            <Bar percent={(counts.done / counts.total) * 100} tone="good" />
            <span className="kopf-fortschritt-zahl">
              {counts.done} / {counts.total}
            </span>
          </div>
        )}
      </div>

      <div className="scroll">
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
          <div className="chips" style={{ paddingTop: 6 }}>
            {restock.slice(0, 8).map(({ item }) => (
              <button
                key={item.id}
                type="button"
                className="chip chip-vorschlag"
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
                + {item.name}
              </button>
            ))}
          </div>
        )}

        {groups.length === 0 ? (
          query ? (
            <Empty
              emoji="🔍"
              title="Nichts gefunden"
              text={`„${query}“ steht nicht auf der Liste.`}
            />
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
              <div className="abteilung">
                <span aria-hidden="true" style={{ fontSize: 15 }}>
                  {group.aisle.emoji}
                </span>
                <span className="abteilung-name">{group.aisle.name}</span>
                {group.openCount > 0 && (
                  <span className="abteilung-zahl">{group.openCount}</span>
                )}
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
                      remove(
                        'shopItems',
                        item.id,
                        { type: 'shop/remove', id: item.id },
                        `„${item.name}“ gelöscht`,
                      )
                    }
                  />
                ))}
              </div>
            </section>
          ))
        )}

        {erledigte.length > 0 && (
          <>
            <button
              type="button"
              className="ausklapp"
              onClick={() => setErledigteOffen(!erledigteOffen)}
              aria-expanded={erledigteOffen}
            >
              <span
                className={`ausklapp-pfeil${erledigteOffen ? ' ausklapp-pfeil-auf' : ''}`}
                aria-hidden="true"
              />
              Im Wagen
              <span className="ausklapp-zahl">
                {erledigte.length}
                {wagenSumme > 0 && ` · ${formatMoney(wagenSumme)}`}
              </span>
            </button>

            {erledigteOffen && (
              <div className="card">
                {erledigte.map((item) => (
                  <ShopRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggle(item)}
                    onOpen={() => setOpen(item)}
                    onPrice={() => setPricing(item)}
                    onDelete={() =>
                      remove(
                        'shopItems',
                        item.id,
                        { type: 'shop/remove', id: item.id },
                        `„${item.name}“ gelöscht`,
                      )
                    }
                  />
                ))}
              </div>
            )}

            <div className="btn-row">
              <button
                type="button"
                className="btn"
                onClick={() => dispatch({ type: 'shop/clearDone' })}
              >
                Nur wegräumen
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setFinishing(true)}>
                Einkauf fertig
              </button>
            </div>
            <p className="small muted" style={{ marginTop: 10, textAlign: 'center' }}>
              „Einkauf fertig“ zählt den Vorrat hoch, bucht die Preise und merkt sich die
              Reihenfolge der Abteilungen in deinem Laden.
            </p>
          </>
        )}
      </div>

      {/* Vorschläge über der Eingabezeile, nicht darunter: Unterhalb lagen sie
          zwischen Feld und Tastatur und waren im Tippen nie zu sehen. */}
      {draft.trim().length > 0 && hints.length > 0 && (
        <div className="chips vorschlaege">
          {hints.map((name) => (
            <button key={name} type="button" className="chip" onClick={() => add(name)}>
              {name}
            </button>
          ))}
        </div>
      )}

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

      <UndoBar state={undo} onDismiss={dismiss} />

      {open && (
        <ItemSheet
          item={open}
          onClose={() => setOpen(null)}
          onDelete={() => {
            remove(
              'shopItems',
              open.id,
              { type: 'shop/remove', id: open.id },
              `„${open.name}“ gelöscht`,
            )
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
    dispatch({
      type: 'shop/update',
      id: item.id,
      patch: { qty: bumpQuantity(item.qty, delta) },
    })
  }

  const fremd = item.addedBy && item.addedBy !== state.settings.displayName
  const sub = [item.note, fremd ? item.addedBy : ''].filter(Boolean).join(' · ')

  return (
    <div className="swipe">
      {/* Nur sichtbar, während gezogen wird. Dauerhaft gemalt blieb von ihr
          eine Viertelpixel-Zeile Rot unter der letzten Zeile einer Karte
          stehen – der Browser rundet die weiße Zeile darüber anders als die
          rote Fläche darunter. */}
      <span
        className="swipe-hint"
        aria-hidden="true"
        style={{ opacity: swipe.offset < 0 ? 1 : 0 }}
      >
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
        <div className={`ware${item.done ? ' ware-erledigt' : ''}`}>
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
            <span className={`ware-kreis${item.done ? ' ware-kreis-on' : ''}`}>
              <IconCheck size={14} />
            </span>
          </span>

          <button
            type="button"
            className="ware-name"
            onClick={onOpen}
            style={{ background: 'none', textAlign: 'left' }}
          >
            {item.name}
            {sub && <span className="zeile-sub">{sub}</span>}
          </button>

          {/* Ist der Eintrag abgehakt, tritt die Menge zurück und der Preis
              nach vorn – im Wagen zählt, was es gekostet hat. */}
          {item.done ? (
            <button
              type="button"
              className={`pille${item.priceCents !== null ? ' pille-preis' : ' pille-leer'}`}
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
              <span className="pille" onClick={() => setStepping(false)}>
                {item.qty || '1'}
              </span>
              <button type="button" onClick={() => bump(1)} aria-label="Menge erhöhen">
                +
              </button>
            </span>
          ) : (
            <button
              type="button"
              className={`pille${item.qty ? '' : ' pille-leer'}`}
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
    dispatch({
      type: 'shop/update',
      id: item.id,
      patch: { priceCents: cents },
    })
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
              dispatch({
                type: 'shop/update',
                id: item.id,
                patch: { priceCents: null },
              })
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

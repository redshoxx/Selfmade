import { useMemo, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { today } from '../lib/date'
import { frequentCategories } from '../lib/finance'
import { formatMoney } from '../lib/money'
import { observedOrder } from '../lib/shopping'
import { live } from '../lib/store'
import { useApp } from '../lib/useApp'

/**
 * Einkauf abschließen.
 *
 * Zwei Dinge passieren hier: Die App lernt aus dem Abhaken die Reihenfolge der
 * Abteilungen, und wenn Preise erfasst wurden, wird die Summe als Ausgabe
 * gebucht. So sieht man, was der Wocheneinkauf wirklich kostet, ohne den
 * Kassenzettel abzutippen.
 *
 * Die Buchung ist freiwillig und lässt sich abwählen – nicht jeder Einkauf
 * gehört ins eigene Haushaltsbuch.
 */
export function AbschlussSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp()

  const done = useMemo(() => live(state.shopItems).filter((item) => item.done), [state.shopItems])
  const priced = done.filter((item) => item.priceCents !== null)
  const summe = priced.reduce((total, item) => total + (item.priceCents ?? 0), 0)

  const categories = useMemo(() => frequentCategories(state, 'ausgabe', 99), [state])
  const [buchen, setBuchen] = useState(summe > 0)
  const [categoryId, setCategoryId] = useState(
    // „Lebensmittel“ ist bei einem Einkauf die weitaus häufigste Wahl.
    categories.find((c) => c.id === 'cat-lebensmittel')?.id ?? categories[0]?.id ?? '',
  )

  const finish = () => {
    if (buchen && summe > 0 && categoryId) {
      dispatch({
        type: 'tx/add',
        tx: {
          kind: 'ausgabe',
          cents: summe,
          categoryId,
          note: 'Einkauf',
          date: today(),
          recurring: false,
        },
      })
    }
    // Reihenfolge lernen und Abgehaktes wegräumen.
    dispatch({ type: 'shop/finishTrip', order: observedOrder(state.shopItems) })
    onClose()
  }

  return (
    <Sheet title="Einkauf abschließen" onClose={onClose}>
      <div className="card pad" style={{ marginBottom: 14 }}>
        <div className="tile-label">Eingekauft</div>
        <div className="big-money">{summe > 0 ? formatMoney(summe) : `${done.length}`}</div>
        <div className="small muted" style={{ marginTop: 4 }}>
          {done.length === 1 ? '1 Eintrag abgehakt' : `${done.length} Einträge abgehakt`}
          {priced.length > 0 && priced.length < done.length && ` · ${priced.length} mit Preis`}
        </div>
      </div>

      {summe > 0 ? (
        <>
          <button
            type="button"
            className={`chip${buchen ? ' chip-on' : ''}`}
            onClick={() => setBuchen(!buchen)}
            aria-pressed={buchen}
          >
            {formatMoney(summe)} als Ausgabe buchen
          </button>

          {buchen && (
            <>
              <span className="field-label" style={{ marginTop: 14 }}>
                Kategorie
              </span>
              <div className="chips">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={`chip${categoryId === category.id ? ' chip-on' : ''}`}
                    onClick={() => setCategoryId(category.id)}
                  >
                    <span aria-hidden="true">{category.emoji}</span>
                    {category.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <p className="small muted">
          Du hast keine Preise erfasst. Tipp beim Einkaufen auf das „+ €“ neben einem abgehakten
          Eintrag, dann rechnet die App den Einkauf zusammen und bucht ihn hier.
        </p>
      )}

      <div className="btn-row">
        <button type="button" className="btn btn-primary btn-wide" onClick={finish}>
          Abschließen
        </button>
      </div>

      <p className="small muted" style={{ marginTop: 12 }}>
        Abgehaktes wird von der Liste genommen. Die Reihenfolge der Abteilungen merkt sich die App
        für den nächsten Einkauf.
      </p>
    </Sheet>
  )
}

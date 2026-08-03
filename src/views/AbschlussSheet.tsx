import { useMemo, useState } from 'react'
import { IconCheck } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { formatDayFull, today } from '../lib/date'
import { frequentCategories } from '../lib/finance'
import { formatMoney } from '../lib/money'
import { ladenStand, observedOrder, vorratsZugaenge } from '../lib/shopping'
import { useApp } from '../lib/useApp'

/**
 * Einkauf abschließen.
 *
 * Drei Dinge passieren hier, und zwei standen bisher nicht da: Die App lernt
 * aus dem Abhaken die Reihenfolge der Abteilungen, sie zählt den Vorrat hoch,
 * und wenn Preise erfasst wurden, bucht sie die Summe als Ausgabe.
 *
 * Nach dem Entwurf stehen sie jetzt als drei abwählbare Zeilen untereinander.
 * Der Unterschied ist nicht kosmetisch: Vorher war allein die Buchung sichtbar
 * und abwählbar, die anderen beiden passierten still. Wer nicht weiß, dass
 * etwas passiert, kann es auch nicht abbestellen.
 */
export function AbschlussSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp()

  const stand = useMemo(() => ladenStand(state), [state])
  const done = stand.imWagen
  const zugaenge = useMemo(() => vorratsZugaenge(state, done), [state, done])

  const categories = useMemo(() => frequentCategories(state, 'ausgabe', 99), [state])
  const [buchen, setBuchen] = useState(stand.summeCents > 0)
  const [inDenVorrat, setInDenVorrat] = useState(true)
  const [merken, setMerken] = useState(true)
  const [categoryId, setCategoryId] = useState(
    // „Lebensmittel“ ist bei einem Einkauf die weitaus häufigste Wahl.
    categories.find((c) => c.id === 'cat-lebensmittel')?.id ?? categories[0]?.id ?? '',
  )

  const finish = () => {
    if (buchen && stand.summeCents > 0 && categoryId) {
      dispatch({
        type: 'tx/add',
        tx: {
          kind: 'ausgabe',
          cents: stand.summeCents,
          categoryId,
          note: 'Einkauf',
          date: today(),
          recurring: false,
        },
      })
    }
    dispatch({
      type: 'shop/finishTrip',
      // Beides abwählbar: `finishTrip` räumt in jedem Fall auf, lernt und
      // bucht aber nur, was hier angehakt steht.
      order: merken ? observedOrder(state.shopItems) : [],
      inDenVorrat: inDenVorrat ? zugaenge.hochzaehlen : [],
    })
    onClose()
  }

  return (
    <Sheet title="Einkauf abschließen" onClose={onClose}>
      <p className="small muted" style={{ margin: '0 2px 14px' }}>
        {formatDayFull(today())} · {done.length === 1 ? '1 Sache' : `${done.length} Sachen`}
      </p>

      <div className="card pad" style={{ marginBottom: 14 }}>
        <div className="tile-label">
          {stand.summeCents > 0 ? 'Summe der eingetippten Preise' : 'Eingekauft'}
        </div>
        <div className="big-money">
          {stand.summeCents > 0 ? formatMoney(stand.summeCents) : String(done.length)}
        </div>
        {stand.ohnePreis > 0 && (
          <div className="small muted" style={{ marginTop: 4 }}>
            {stand.ohnePreis === 1
              ? '1 Eintrag ohne Preis – zählt nicht mit'
              : `${stand.ohnePreis} Einträge ohne Preis – zählen nicht mit`}
          </div>
        )}
      </div>

      {/* Drei Zeilen, drei Häkchen. Was die App tut, steht da, bevor sie es
          tut – und lässt sich einzeln abbestellen. */}
      <div className="card">
        {stand.summeCents > 0 && (
          <ZeileMitHaken
            an={buchen}
            onToggle={() => setBuchen(!buchen)}
            titel={`${formatMoney(stand.summeCents)} als Ausgabe buchen`}
          />
        )}
        {zugaenge.hochzaehlen.length > 0 && (
          <ZeileMitHaken
            an={inDenVorrat}
            onToggle={() => setInDenVorrat(!inDenVorrat)}
            titel={
              zugaenge.hochzaehlen.length === 1
                ? '1 Posten im Vorrat hochzählen'
                : `${zugaenge.hochzaehlen.length} Posten im Vorrat hochzählen`
            }
          />
        )}
        <ZeileMitHaken
          an={merken}
          onToggle={() => setMerken(!merken)}
          titel="Reihenfolge dieses Ladens merken"
        />
      </div>

      {buchen && stand.summeCents > 0 && (
        <>
          <span className="field-label" style={{ marginTop: 14 }}>
            Als Ausgabe buchen in
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

      {stand.summeCents === 0 && (
        <p className="small muted" style={{ marginTop: 12 }}>
          Du hast keine Preise erfasst. Im Modus „Im Laden“ erscheint nach jedem Häkchen ein
          Preisfeld – dann rechnet die App den Einkauf hier zusammen.
        </p>
      )}

      <div className="btn-row">
        <button type="button" className="btn" onClick={onClose}>
          Zurück
        </button>
        <button type="button" className="btn btn-primary" onClick={finish}>
          Abschließen
        </button>
      </div>

      <p className="small muted" style={{ marginTop: 12 }}>
        Abgehaktes wird von der Liste genommen.
        {zugaenge.neu.length > 0 &&
          ` ${
            zugaenge.neu.length === 1
              ? 'Ein neues Produkt wartet'
              : `${zugaenge.neu.length} neue Produkte warten`
          } im Vorrat auf dich – mit Datum, wenn du auspackst.`}
      </p>
    </Sheet>
  )
}

function ZeileMitHaken({ an, onToggle, titel }: { an: boolean; onToggle: () => void; titel: string }) {
  return (
    <button
      type="button"
      className="row"
      onClick={onToggle}
      role="checkbox"
      aria-checked={an}
      aria-label={titel}
    >
      <span className={`check${an ? ' check-on' : ''}`} aria-hidden="true">
        <IconCheck size={15} />
      </span>
      <span className="row-main">
        <span className="row-title" style={{ fontWeight: 500 }}>
          {titel}
        </span>
      </span>
    </button>
  )
}

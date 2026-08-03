import { useMemo, useState } from 'react'
import { AmountField } from '../components/Bits'
import { IconCheck, IconChevron } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { formatMoney } from '../lib/money'
import { tick } from '../lib/platform'
import { ladenStand } from '../lib/shopping'
import { useApp } from '../lib/useApp'
import type { ShopItem } from '../lib/types'

/**
 * Der Modus „Im Laden“.
 *
 * Die Liste zeigt alle Abteilungen untereinander – zu Hause ist das richtig,
 * dort überblickt man, was fehlt. Im Laden steht man aber in genau einer
 * Abteilung, mit einer Hand am Wagen. Deshalb hier: eine Abteilung pro
 * Bildschirm, Zeilen mit der doppelten Fläche, und unten eine Summe, die
 * mitläuft.
 *
 * Kein eigener Zustand für den Fortschritt. Welche Abteilung dran ist, steht
 * hier; was erledigt ist, steht in den Einträgen selbst. Ein Zähler daneben
 * liefe auseinander, sobald die andere Person zu Hause etwas von der Liste
 * nimmt – und genau das ist der Normalfall bei einer geteilten Liste.
 */
export function ImLadenView({ onFertig, onBeenden }: { onFertig: () => void; onBeenden: () => void }) {
  const { state, dispatch } = useApp()
  const stand = useMemo(() => ladenStand(state), [state])
  const [index, setIndex] = useState(0)
  const [preisFuer, setPreisFuer] = useState<ShopItem | null>(null)

  // Die Liste kann sich unter einem ändern: Die andere Person räumt zu Hause
  // auf, während man im Laden steht. Dann lieber auf die letzte Abteilung
  // rutschen als auf einen leeren Bildschirm.
  const anzahl = stand.abteilungen.length
  const sicher = anzahl === 0 ? 0 : Math.min(index, anzahl - 1)
  const gruppe = stand.abteilungen[sicher]

  if (!gruppe) {
    return (
      <div className="laden">
        <div className="laden-kopf">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="laden-marke">Im Laden</span>
            <button type="button" className="laden-beenden" onClick={onBeenden}>
              Beenden
            </button>
          </div>
        </div>
        <div className="laden-liste">
          <p className="muted" style={{ marginTop: 40, textAlign: 'center' }}>
            Auf der Liste steht nichts mehr.
          </p>
        </div>
      </div>
    )
  }

  const letzte = sicher === anzahl - 1
  const naechste = stand.abteilungen[sicher + 1]

  /**
   * Was unter dem Namen steht – oder nichts.
   *
   * Der eigene Name gehört nicht dazu: „von Ich“ an jeder Zeile ist Rauschen,
   * und dass man selbst aufgeschrieben hat, was auf der eigenen Liste steht,
   * ist der Normalfall. Dieselbe Regel benutzt die Liste seit jeher.
   */
  const unterzeile = (item: ShopItem): string =>
    [item.note, item.addedBy && item.addedBy !== state.settings.displayName ? `von ${item.addedBy}` : '']
      .filter(Boolean)
      .join(' · ')

  const toggle = (item: ShopItem) => {
    tick(state.settings.haptics)
    dispatch({ type: 'shop/toggle', id: item.id })
    // Beim Abhaken gleich nach dem Preis fragen – nicht als Rückfrage, die
    // man wegdrücken muss, sondern als Feld, das eben da ist. Wer nichts
    // eintippt, schließt es und die Summe zählt ohne diesen Posten weiter.
    if (!item.done) setPreisFuer(item)
  }

  return (
    <div className="laden">
      <div className="laden-kopf">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="laden-marke">Im Laden</span>
          <button type="button" className="laden-beenden" onClick={onBeenden}>
            Beenden
          </button>
        </div>

        <div
          className="laden-fortschritt"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={anzahl}
          aria-valuenow={sicher + 1}
          aria-label={`Abteilung ${sicher + 1} von ${anzahl}`}
        >
          {stand.abteilungen.map((g, i) => (
            <span
              key={g.aisle.id}
              className={`laden-schritt${
                i < sicher || g.openCount === 0 ? ' laden-schritt-fertig' : ''
              }${i === sicher ? ' laden-schritt-hier' : ''}`}
            />
          ))}
        </div>

        <div className="laden-titel">
          <span style={{ fontSize: 26 }} aria-hidden="true">
            {gruppe.aisle.emoji}
          </span>
          <h2>{gruppe.aisle.name}</h2>
        </div>
        <div className="laden-sub">
          {letzte ? 'Letzte Abteilung' : `Abteilung ${sicher + 1} von ${anzahl}`}
          {' · '}
          {gruppe.openCount === 0
            ? 'alles abgehakt'
            : gruppe.openCount === 1
              ? 'noch 1 Sache'
              : `noch ${gruppe.openCount} Sachen`}
        </div>
      </div>

      <div className="laden-liste">
        {gruppe.items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`laden-zeile${item.done ? ' laden-zeile-erledigt' : ''}`}
            onClick={() => toggle(item)}
            role="checkbox"
            aria-checked={item.done}
          >
            <span className={`laden-kreis${item.done ? ' laden-kreis-on' : ''}`} aria-hidden="true">
              <IconCheck size={18} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="laden-name">{item.name}</span>
              {!item.done && unterzeile(item) && (
                <span className="laden-sub-zeile">{unterzeile(item)}</span>
              )}
            </span>

            {item.done ? (
              <span
                className={`laden-preis${item.priceCents === null ? ' laden-preis-leer' : ''}`}
                onClick={(event) => {
                  event.stopPropagation()
                  setPreisFuer(item)
                }}
              >
                {item.priceCents === null ? '+ €' : formatMoney(item.priceCents)}
              </span>
            ) : (
              item.qty && <span className="laden-menge">{item.qty}</span>
            )}
          </button>
        ))}

        {gruppe.items.every((i) => !i.done) && (
          <p className="small muted" style={{ margin: '8px 2px 0' }}>
            Nach dem Abhaken erscheint das Preisfeld – tippen ist freiwillig, die Summe unten zählt
            trotzdem mit.
          </p>
        )}
      </div>

      <div className="laden-fuss">
        <div className="laden-summe">
          <span className="small muted">
            {stand.imWagen.length === 1 ? '1 im Wagen' : `${stand.imWagen.length} im Wagen`}
            {stand.ohnePreis > 0 && ` · ${stand.ohnePreis} ohne Preis`}
          </span>
          <span className="laden-summe-zahl">{formatMoney(stand.summeCents)}</span>
        </div>

        <div className="laden-weiter">
          <button
            type="button"
            className="laden-zurueck"
            onClick={() => setIndex(Math.max(0, sicher - 1))}
            disabled={sicher === 0}
            aria-label="Vorherige Abteilung"
            style={{ opacity: sicher === 0 ? 0.4 : 1 }}
          >
            <span style={{ transform: 'rotate(180deg)', display: 'grid' }}>
              <IconChevron size={22} />
            </span>
          </button>

          {letzte ? (
            <button type="button" className="laden-vor" onClick={onFertig}>
              Einkauf fertig
            </button>
          ) : (
            <button type="button" className="laden-vor" onClick={() => setIndex(sicher + 1)}>
              Weiter zu {naechste?.aisle.name}
            </button>
          )}
        </div>
      </div>

      {preisFuer && <PreisBlatt item={preisFuer} onClose={() => setPreisFuer(null)} />}
    </div>
  )
}

/**
 * Preis nachtragen.
 *
 * Bewusst ohne „Abbrechen“: Schließen *ist* das Abbrechen, und wer nichts
 * eintippt, hat nichts geändert. Ein zweiter Knopf daneben ließe zweifeln,
 * ob das Schließen etwas verwirft.
 */
function PreisBlatt({ item, onClose }: { item: ShopItem; onClose: () => void }) {
  const { dispatch } = useApp()
  const [cents, setCents] = useState<number | null>(item.priceCents)

  const speichern = () => {
    dispatch({ type: 'shop/update', id: item.id, patch: { priceCents: cents } })
    onClose()
  }

  return (
    <Sheet title={item.name} onClose={onClose}>
      <AmountField cents={cents} onChange={setCents} autoFocus label="Was hat es gekostet?" />
      <p className="small muted" style={{ marginTop: -6 }}>
        Freiwillig. Beim Abschließen wird die Summe aller Preise als Ausgabe gebucht.
      </p>
      <div className="btn-row">
        <button type="button" className="btn btn-primary btn-wide" onClick={speichern}>
          Übernehmen
        </button>
      </div>
    </Sheet>
  )
}

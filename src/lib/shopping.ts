import { AISLES, DEFAULT_AISLE_ORDER, aisle, type Aisle } from './aisles'
import { splitQuantity } from './quantity'
import { live } from './entity'
import type { AisleId, ShopItem, State } from './types'

/**
 * Die Einkaufsliste – sortiert nach dem Weg durch den Laden.
 *
 * Eine alphabetische Liste zwingt dazu, den Markt mehrfach zu durchqueren.
 * Deshalb gruppiert die App nach Abteilung und bringt die Abteilungen in die
 * Reihenfolge, in der man sie tatsächlich passiert. Woher sie die kennt: aus
 * dem Abhaken. Wer beim Einkauf oben anfängt und sich durcharbeitet, verrät
 * dabei die Anordnung seines Ladens, ohne je etwas einstellen zu müssen.
 */

/** Position einer Abteilung auf dem Weg – kleiner heißt früher. */
export function aisleRank(state: Pick<State, 'aisleOrder'>, id: AisleId): number {
  const learned = state.aisleOrder[id]
  if (learned !== undefined) return learned
  // Noch nichts gelernt: die übliche Anordnung eines Supermarkts.
  const fallback = DEFAULT_AISLE_ORDER.indexOf(id)
  return fallback === -1 ? DEFAULT_AISLE_ORDER.length : fallback
}

/** Abteilungen in der Reihenfolge des Rundgangs. */
export function orderedAisles(state: Pick<State, 'aisleOrder'>): Aisle[] {
  return [...AISLES].sort((a, b) => aisleRank(state, a.id) - aisleRank(state, b.id))
}

export interface AisleGroup {
  aisle: Aisle
  items: ShopItem[]
  openCount: number
}

/**
 * Offene Einträge nach Abteilung, in Laufrichtung.
 *
 * Leere Abteilungen fallen weg – eine Überschrift ohne Inhalt kostet nur
 * Platz und eine Wischbewegung.
 */
export function groupForShopping(
  state: Pick<State, 'shopItems' | 'aisleOrder'>,
  options: { includeDone?: boolean } = {},
): AisleGroup[] {
  const byAisle = new Map<AisleId, ShopItem[]>()
  for (const item of live(state.shopItems)) {
    if (item.done && !options.includeDone) continue
    const list = byAisle.get(item.aisle)
    if (list) list.push(item)
    else byAisle.set(item.aisle, [item])
  }

  const groups: AisleGroup[] = []
  for (const [id, items] of byAisle) {
    // Innerhalb einer Abteilung: Offenes oben, dann alphabetisch. So wandert
    // Abgehaktes beim Einkauf nach unten aus dem Blick.
    items.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      return a.name.localeCompare(b.name, 'de')
    })
    groups.push({
      aisle: aisle(id),
      items,
      openCount: items.filter((i) => !i.done).length,
    })
  }

  return groups.sort((a, b) => aisleRank(state, a.aisle.id) - aisleRank(state, b.aisle.id))
}

/**
 * Reihenfolge, in der die Abteilungen beim Einkauf abgehakt wurden.
 *
 * Grundlage fürs Lernen: Wer zuerst Obst und zuletzt Getränke abhakt, ist
 * vermutlich in dieser Richtung durch den Laden gegangen. Gewertet wird der
 * Zeitpunkt des *ersten* Häkchens je Abteilung – wer später noch einmal
 * zurückläuft, weil er die Butter vergessen hat, soll die Reihenfolge nicht
 * durcheinanderbringen.
 */
export function observedOrder(items: readonly ShopItem[]): AisleId[] {
  const firstTouch = new Map<AisleId, number>()
  for (const item of items) {
    if (!item.done || item.deletedAt !== null) continue
    const seen = firstTouch.get(item.aisle)
    if (seen === undefined || item.updatedAt < seen) firstTouch.set(item.aisle, item.updatedAt)
  }
  return Array.from(firstTouch.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id)
}

/* --- Erfassen ------------------------------------------------------------- */

export interface ShopCounts {
  open: number
  done: number
  total: number
}

export function shopCounts(state: Pick<State, 'shopItems'>): ShopCounts {
  let open = 0
  let done = 0
  for (const item of live(state.shopItems)) {
    if (item.done) done++
    else open++
  }
  return { open, done, total: open + done }
}

/**
 * Steht der Name schon auf der Liste?
 *
 * Verhindert, dass „Milch“ dreimal auftaucht, weil zwei Leute gleichzeitig
 * daran gedacht haben. Verglichen wird großzügig: ohne Groß- und
 * Kleinschreibung und ohne umgebenden Leerraum.
 */
export function findExisting(state: Pick<State, 'shopItems'>, name: string): ShopItem | null {
  const needle = name.trim().toLowerCase()
  if (!needle) return null
  return live(state.shopItems).find((item) => item.name.trim().toLowerCase() === needle) ?? null
}

/**
 * Vorschläge beim Tippen: was zuletzt auf der Liste stand.
 *
 * Zieht aus den erledigten und gelöschten Einträgen – das ist der ehrlichste
 * Einkaufszettel, den es gibt. Häufiges steht vorn.
 */
export function suggestions(state: Pick<State, 'shopItems'>, query: string, limit = 6): string[] {
  const needle = query.trim().toLowerCase()
  const onList = new Set(live(state.shopItems).map((i) => i.name.trim().toLowerCase()))

  const counts = new Map<string, { name: string; count: number; last: number }>()
  for (const item of state.shopItems) {
    const key = item.name.trim().toLowerCase()
    if (!key || onList.has(key)) continue // was schon draufsteht, hilft nicht
    if (needle && !key.includes(needle)) continue
    const seen = counts.get(key)
    if (seen) {
      seen.count++
      seen.last = Math.max(seen.last, item.updatedAt)
    } else {
      counts.set(key, {
        name: item.name.trim(),
        count: 1,
        last: item.updatedAt,
      })
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => (b.count === a.count ? b.last - a.last : b.count - a.count))
    .slice(0, limit)
    .map((entry) => entry.name)
}

/* --- Vom Einkauf in den Vorrat -------------------------------------------- */

/** Ein Posten, der im Vorrat schon liegt und nur hochgezählt wird. */
export interface Zugang {
  pantryId: string
  menge: number
}

/** Etwas Gekauftes, das es im Vorrat noch nicht gibt. */
export interface NeuGekauft {
  /** Kennung des Einkaufseintrags – damit die Oberfläche ihn wiederfindet. */
  shopId: string
  name: string
  aisle: AisleId
  menge: number
  einheit: string
}

export interface Vorratszugaenge {
  hochzaehlen: Zugang[]
  neu: NeuGekauft[]
}

/**
 * Was der abgeschlossene Einkauf für den Vorrat bedeutet.
 *
 * Die Trennung ist der Kern: Ein Eintrag mit `pantryId` kam aus einem
 * Nachkaufen-Vorschlag. Das Produkt liegt also bereits im Vorrat, mit Einheit
 * und Mindestbestand – da lässt sich ohne Rückfrage hochzählen, es kann nichts
 * schiefgehen. Alles andere ist eine Vermutung und wird deshalb später gefragt,
 * beim Auspacken, wenn man das Produkt in der Hand hält.
 *
 * Ließe man auch das Neue automatisch einlaufen, stünden Coffee-to-go und das
 * Brötchen von heute Morgen als „Vorrat“ da. Ein Vorrat voller Dinge, die keine
 * sind, ist so unbrauchbar wie gar keiner.
 */
export function vorratsZugaenge(
  state: Pick<State, 'shopItems' | 'pantryItems'>,
  gekauft: readonly ShopItem[] = live(state.shopItems).filter((item) => item.done),
): Vorratszugaenge {
  const imVorrat = new Map(live(state.pantryItems).map((item) => [item.id, item]))
  const nachName = new Map(
    live(state.pantryItems).map((item) => [item.name.trim().toLowerCase(), item]),
  )

  const hochzaehlen: Zugang[] = []
  const neu: NeuGekauft[] = []

  for (const item of gekauft) {
    const geteilt = splitQuantity(item.qty)
    // Unklare Menge zählt als eins: „ein Karton Milch“ ist mehr als nichts,
    // und null zu buchen wäre schlechter als ungenau zu buchen.
    const menge = geteilt && geteilt.amount > 0 ? geteilt.amount : 1

    // Erst über die Kennung, dann über den Namen. Der zweite Weg fängt den
    // Fall, dass jemand „Milch“ von Hand aufgeschrieben hat, obwohl sie im
    // Vorrat steht – sonst entstünde ein zweiter Posten desselben Produkts.
    const treffer =
      (item.pantryId ? imVorrat.get(item.pantryId) : undefined) ??
      nachName.get(item.name.trim().toLowerCase())

    if (treffer) hochzaehlen.push({ pantryId: treffer.id, menge })
    else {
      neu.push({
        shopId: item.id,
        name: item.name.trim(),
        aisle: item.aisle,
        menge,
        einheit: geteilt?.unit || 'Stück',
      })
    }
  }

  return { hochzaehlen, neu }
}

/**
 * Was zuletzt gekauft wurde und noch nicht im Vorrat steht.
 *
 * Speist den Streifen „neu gekauft“ im Vorrat – gedacht für den Augenblick,
 * in dem man die Tüten auspackt und das Produkt in der Hand hält. Erst da
 * kennt man das Mindesthaltbarkeitsdatum, und erst da weiß man, ob es
 * überhaupt Vorrat ist oder heute noch gegessen wird.
 *
 * Braucht kein neues Feld: Abgehakte Einträge bleiben nach dem Abschließen als
 * Grabsteine liegen, mit Name, Menge und Zeitpunkt. Es braucht auch kein
 * Wegklicken – der Streifen räumt sich von selbst ab. Wer das Produkt
 * übernimmt, dessen Name findet danach einen Vorratsposten und fällt heraus;
 * alles andere fällt nach `fensterMs` heraus.
 *
 * Zwei Stunden, weil das die Spanne zwischen Kasse und Auspacken ist. Länger
 * gedacht klingt großzügig, ist es aber nicht: Was am Abend noch dasteht, hat
 * man bewusst nicht übernommen, und es dann am nächsten Morgen wieder
 * angeboten zu bekommen, macht aus einem Angebot eine Aufgabe.
 *
 * Verloren geht dabei nichts – der Grabstein bleibt liegen, er wird nur nicht
 * mehr vorgeschlagen.
 */
export const FRISCH_FENSTER_MS = 2 * 60 * 60 * 1000

export function neuGekauft(
  state: Pick<State, 'shopItems' | 'pantryItems'>,
  jetzt: number = Date.now(),
  fensterMs: number = FRISCH_FENSTER_MS,
): NeuGekauft[] {
  const grenze = jetzt - fensterMs
  const imVorrat = new Set(live(state.pantryItems).map((i) => i.name.trim().toLowerCase()))

  // Je Name nur der jüngste Kauf: Zwei Wochen hintereinander Milch ergäbe
  // sonst zwei gleiche Zeilen im Streifen.
  const jeName = new Map<string, ShopItem>()
  for (const item of state.shopItems) {
    if (!item.done || item.deletedAt === null || item.deletedAt < grenze) continue
    const key = item.name.trim().toLowerCase()
    if (!key || imVorrat.has(key)) continue
    const bisher = jeName.get(key)
    if (!bisher || item.deletedAt > (bisher.deletedAt ?? 0)) jeName.set(key, item)
  }

  return Array.from(jeName.values())
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
    .map((item) => {
      const geteilt = splitQuantity(item.qty)
      return {
        shopId: item.id,
        name: item.name.trim(),
        aisle: item.aisle,
        menge: geteilt && geteilt.amount > 0 ? geteilt.amount : 1,
        einheit: geteilt?.unit || 'Stück',
      }
    })
}

/* --- Der Modus „Im Laden“ ------------------------------------------------- */

/**
 * Was der Einkaufsmodus wissen muss.
 *
 * Die Liste zeigt alle Abteilungen untereinander. Im Laden steht man aber in
 * genau einer – deshalb geht der Modus sie einzeln durch und braucht dafür
 * dreierlei: welche Abteilungen überhaupt vorkommen, wie weit der Wagen ist,
 * und was er bisher kostet.
 *
 * Rein und ohne eigenen Zustand: Der Fortschritt steckt in den Einträgen
 * selbst (`done`), nicht in einem Zähler daneben. Ein Zähler daneben liefe
 * auseinander, sobald die andere Person zu Hause etwas von der Liste nimmt.
 */
export interface LadenStand {
  /**
   * Abteilungen mit mindestens einem Eintrag – abgehakte eingeschlossen, damit
   * eine Abteilung nicht unter den Füßen verschwindet, während man in ihr
   * steht und gerade das Letzte abhakt.
   */
  abteilungen: AisleGroup[]
  imWagen: ShopItem[]
  /** Summe der eingetippten Preise. Wer keinen tippt, zählt hier nicht mit. */
  summeCents: number
  /** Abgehakt, aber ohne Preis – die Zahl, die den Betrag unten erklärt. */
  ohnePreis: number
}

export function ladenStand(state: Pick<State, 'shopItems' | 'aisleOrder'>): LadenStand {
  const abteilungen = groupForShopping(state, { includeDone: true })
  const imWagen = live(state.shopItems).filter((item) => item.done)
  return {
    abteilungen,
    imWagen,
    summeCents: imWagen.reduce((summe, item) => summe + (item.priceCents ?? 0), 0),
    ohnePreis: imWagen.filter((item) => item.priceCents === null).length,
  }
}

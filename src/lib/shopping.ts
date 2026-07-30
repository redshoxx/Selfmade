import { AISLES, DEFAULT_AISLE_ORDER, aisle, type Aisle } from './aisles'
import { live } from './store'
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
    groups.push({ aisle: aisle(id), items, openCount: items.filter((i) => !i.done).length })
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
      counts.set(key, { name: item.name.trim(), count: 1, last: item.updatedAt })
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => (b.count === a.count ? b.last - a.last : b.count - a.count))
    .slice(0, limit)
    .map((entry) => entry.name)
}

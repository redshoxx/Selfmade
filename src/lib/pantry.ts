import { aisle } from './aisles'
import { daysBetween, today, type IsoDate } from './date'
import { live } from './entity'
import type { AisleId, PantryItem, State } from './types'

/**
 * Der Vorrat und sein Ablaufdatum.
 *
 * Die Warnschwellen hängen an der Abteilung, nicht an einer festen Frist.
 * Hackfleisch braucht einen Tag Vorwarnung, eine Dose Kichererbsen darf einen
 * Monat vorher erinnern. Eine gemeinsame Formel für beides wäre entweder
 * Panikmache oder käme zu spät – und Warnungen, die zu oft kommen, klickt man
 * irgendwann blind weg.
 */

export type ExpiryState =
  /** Kein Datum hinterlegt. */
  | 'unbekannt'
  /** Datum liegt in der Zukunft, alles ruhig. */
  | 'frisch'
  /** Läuft demnächst ab – im Blick behalten. */
  | 'bald'
  /** Muss jetzt weg. */
  | 'dringend'
  /** Datum überschritten. */
  | 'abgelaufen'

export interface Expiry {
  state: ExpiryState
  /** Tage bis zum Datum; negativ heißt überschritten. `null` ohne Datum. */
  days: number | null
}

export function expiryOf(item: PantryItem, now: IsoDate = today()): Expiry {
  if (!item.bestBefore) return { state: 'unbekannt', days: null }

  const days = daysBetween(now, item.bestBefore)
  if (days < 0) return { state: 'abgelaufen', days }

  const { warnDays, urgentDays } = aisle(item.aisle)
  if (days <= urgentDays) return { state: 'dringend', days }
  if (days <= warnDays) return { state: 'bald', days }
  return { state: 'frisch', days }
}

/** Reihenfolge für die Anzeige: Was drängt, steht oben. */
const SEVERITY: Record<ExpiryState, number> = {
  abgelaufen: 0,
  dringend: 1,
  bald: 2,
  frisch: 3,
  unbekannt: 4,
}

export function severity(state: ExpiryState): number {
  return SEVERITY[state]
}

/** Braucht dieser Eintrag Aufmerksamkeit? */
export function needsAttention(state: ExpiryState): boolean {
  return state === 'abgelaufen' || state === 'dringend' || state === 'bald'
}

/* --- Bestand -------------------------------------------------------------- */

/**
 * Ist der Bestand unter dem Mindestwert?
 *
 * `minQty` von 0 schaltet die Überwachung ab – nicht jeder will an Senf
 * erinnert werden.
 */
export function isLow(item: PantryItem): boolean {
  return item.minQty > 0 && item.qty <= item.minQty
}

export function isEmpty(item: PantryItem): boolean {
  return item.qty <= 0
}

/* --- Sichten -------------------------------------------------------------- */

export interface PantryEntry {
  item: PantryItem
  expiry: Expiry
  low: boolean
  empty: boolean
}

export function entries(state: Pick<State, 'pantryItems'>, now: IsoDate = today()): PantryEntry[] {
  return live(state.pantryItems).map((item) => ({
    item,
    expiry: expiryOf(item, now),
    low: isLow(item),
    empty: isEmpty(item),
  }))
}

export type PantryFilter = 'alle' | 'ablauf' | 'nachkaufen' | 'leer'

export function filterEntries(list: readonly PantryEntry[], filter: PantryFilter): PantryEntry[] {
  switch (filter) {
    case 'ablauf':
      return list.filter((e) => needsAttention(e.expiry.state))
    case 'nachkaufen':
      return list.filter((e) => e.low)
    case 'leer':
      return list.filter((e) => e.empty)
    case 'alle':
      return [...list]
  }
}

/**
 * Sortierung für die Vorratsliste: Dringendes zuerst, dann nach Datum, dann
 * alphabetisch. Der Name als letztes Kriterium hält die Liste stabil – ohne ihn
 * springen gleichrangige Einträge bei jedem Neuzeichnen umher.
 */
export function sortEntries(list: readonly PantryEntry[]): PantryEntry[] {
  return [...list].sort((a, b) => {
    const bySeverity = severity(a.expiry.state) - severity(b.expiry.state)
    if (bySeverity !== 0) return bySeverity
    if (a.expiry.days !== null && b.expiry.days !== null && a.expiry.days !== b.expiry.days) {
      return a.expiry.days - b.expiry.days
    }
    return a.item.name.localeCompare(b.item.name, 'de')
  })
}

/** Nach Abteilung gruppiert – für die Rasteransicht. */
export function groupByAisle(list: readonly PantryEntry[]): { aisleId: AisleId; entries: PantryEntry[] }[] {
  const groups = new Map<AisleId, PantryEntry[]>()
  for (const entry of sortEntries(list)) {
    const existing = groups.get(entry.item.aisle)
    if (existing) existing.push(entry)
    else groups.set(entry.item.aisle, [entry])
  }
  return Array.from(groups, ([aisleId, items]) => ({ aisleId, entries: items }))
}

/* --- Hinweise ------------------------------------------------------------- */

export interface PantryCounts {
  /** Abgelaufen oder dringend – der Zähler am Reiter. */
  urgent: number
  /** Läuft demnächst ab. */
  soon: number
  /** Unter dem Mindestbestand. */
  low: number
  total: number
}

export function pantryCounts(state: Pick<State, 'pantryItems'>, now: IsoDate = today()): PantryCounts {
  let urgent = 0
  let soon = 0
  let low = 0
  let total = 0
  for (const entry of entries(state, now)) {
    total++
    if (entry.expiry.state === 'abgelaufen' || entry.expiry.state === 'dringend') urgent++
    else if (entry.expiry.state === 'bald') soon++
    if (entry.low) low++
  }
  return { urgent, soon, low, total }
}

/**
 * Was noch nicht auf der Einkaufsliste steht, aber zur Neige geht.
 *
 * Bereits vorgeschlagene Einträge fallen raus: Sonst schlägt die App dasselbe
 * Produkt jedes Mal erneut vor, obwohl es längst auf der Liste steht.
 */
export function restockSuggestions(
  state: Pick<State, 'pantryItems' | 'shopItems'>,
  now: IsoDate = today(),
): PantryEntry[] {
  const onList = new Set<string>()
  for (const item of live(state.shopItems)) {
    if (item.pantryId) onList.add(item.pantryId)
    onList.add(item.name.trim().toLowerCase())
  }

  return sortEntries(
    entries(state, now).filter(
      (entry) =>
        (entry.low || entry.empty) &&
        !onList.has(entry.item.id) &&
        !onList.has(entry.item.name.trim().toLowerCase()),
    ),
  )
}

/**
 * Der Satz, der auf der Startseite steht.
 *
 * Eine klare Aussage statt vier Zahlen: Wer die App aufmacht, soll in einem
 * Blick wissen, ob etwas zu tun ist.
 */
export function pantryHeadline(counts: PantryCounts): string | null {
  if (counts.urgent > 0) {
    return counts.urgent === 1 ? '1 Produkt muss jetzt weg' : `${counts.urgent} Produkte müssen jetzt weg`
  }
  if (counts.soon > 0) {
    return counts.soon === 1 ? '1 Produkt läuft bald ab' : `${counts.soon} Produkte laufen bald ab`
  }
  if (counts.low > 0) {
    return counts.low === 1 ? '1 Produkt geht zur Neige' : `${counts.low} Produkte gehen zur Neige`
  }
  return null
}

/* --- Erinnerung ----------------------------------------------------------- */

export interface Erinnerung {
  /** Was in der Meldung steht, fertig formuliert. */
  titel: string
  text: string
  /** Die betroffenen Produkte – für Tests und zum Nachsehen. */
  produkte: PantryItem[]
}

/**
 * Woran heute zu erinnern ist – oder `null`, wenn an nichts.
 *
 * Läuft in der App **und** in der Edge Function, die abends die
 * Benachrichtigung verschickt. Genau deshalb steht sie hier und nicht in SQL:
 * Zwei Fassungen derselben Regel driften auseinander, und dann warnt die App
 * anders als das Telefon – ein Fehler, den niemand bemerkt, weil beide für
 * sich plausibel aussehen.
 *
 * Bewusst **ohne** die Stufe `bald`. Bei Konserven umfasst die 30 Tage, und
 * eine Meldung über eine Dose, die in vier Wochen abläuft, ist der Anfang vom
 * Wegklicken. Und gibt es nichts, kommt nichts: Eine tägliche
 * „alles-in-Ordnung“-Meldung erzieht dazu, sie zu übersehen.
 */
export function erinnerung(
  state: Pick<State, 'pantryItems'>,
  now: IsoDate = today(),
): Erinnerung | null {
  const dringend = entries(state, now)
    .filter((e) => e.expiry.state === 'abgelaufen' || e.expiry.state === 'dringend')
    // Leere Fächer nicht melden: Was aufgebraucht ist, kann nicht verderben.
    .filter((e) => e.item.qty > 0)

  if (dringend.length === 0) return null

  const sortiert = sortEntries(dringend)
  const namen = sortiert.map((e) => e.item.name)
  const abgelaufen = sortiert.filter((e) => e.expiry.state === 'abgelaufen').length

  return {
    titel:
      dringend.length === 1
        ? `${namen[0]} muss weg`
        : `${dringend.length} Sachen müssen weg`,
    // Höchstens drei Namen: Was länger ist, schneidet das Telefon ohnehin ab.
    text:
      namen.slice(0, 3).join(', ') +
      (namen.length > 3 ? ` und ${namen.length - 3} mehr` : '') +
      (abgelaufen > 0 ? ` · ${abgelaufen === 1 ? '1 schon abgelaufen' : `${abgelaufen} schon abgelaufen`}` : ''),
    produkte: sortiert.map((e) => e.item),
  }
}

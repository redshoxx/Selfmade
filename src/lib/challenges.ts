import { addDays, addMonths, daysBetween, today, type IsoDate } from './date'
import { slotAmount } from './store'
import type { Challenge, ChallengeKind, ChallengeUnit } from './types'

/**
 * Spar-Challenges.
 *
 * Eine Challenge ist eine Reihe von Feldern. Jedes Feld steht für einen Betrag;
 * wer es abhakt, legt das Geld zurück. Drei Spielarten decken alles ab, was
 * üblicherweise gespielt wird:
 *
 *   steigend – Feld n kostet n × Schritt, der Reihe nach.
 *              Die klassische 52-Wochen-Challenge: 1 €, 2 €, 3 € … 52 €.
 *   gleich   – jedes Feld kostet dasselbe. „Jede Woche 5 € weg.“
 *   frei     – dieselben gestaffelten Beträge, aber man sucht sich jede Woche
 *              eines aus. In einer teuren Woche das 3-€-Feld, in einer guten
 *              das 48-€-Feld. Das ist der Grund, warum die meisten Challenges
 *              nicht im November scheitern.
 */

export interface ChallengeTemplate {
  id: string
  name: string
  description: string
  emoji: string
  kind: ChallengeKind
  stepCents: number
  slots: number
  unit: ChallengeUnit
}

/** Fertige Challenges für den Einstieg – ein Tipp genügt. */
export const TEMPLATES: readonly ChallengeTemplate[] = [
  {
    id: 'euro-1',
    name: '1-€-Challenge',
    description: 'Woche 1 einen Euro, Woche 2 zwei Euro – bis Woche 52.',
    emoji: '1️⃣',
    kind: 'steigend',
    stepCents: 100,
    slots: 52,
    unit: 'woche',
  },
  {
    id: 'euro-2',
    name: '2-€-Challenge',
    description: 'Wie die 1-€-Challenge, nur in doppelten Schritten.',
    emoji: '2️⃣',
    kind: 'steigend',
    stepCents: 200,
    slots: 52,
    unit: 'woche',
  },
  {
    id: 'euro-5',
    name: '5-€-Challenge',
    description: 'Fünfer-Schritte über ein Jahr. Ordentlich sportlich.',
    emoji: '5️⃣',
    kind: 'steigend',
    stepCents: 500,
    slots: 52,
    unit: 'woche',
  },
  {
    id: 'frei-1',
    name: '1 € frei einteilen',
    description: 'Dieselben 52 Beträge – du suchst dir jede Woche einen aus.',
    emoji: '🎲',
    kind: 'frei',
    stepCents: 100,
    slots: 52,
    unit: 'woche',
  },
  {
    id: 'fest-5',
    name: '5 € jede Woche',
    description: 'Gleicher Betrag, keine Überraschungen.',
    emoji: '📅',
    kind: 'gleich',
    stepCents: 500,
    slots: 52,
    unit: 'woche',
  },
  {
    id: 'cent-365',
    name: '1-Cent-Challenge',
    description: 'Tag 1 einen Cent, Tag 365 dann 3,65 €. Fast unmerklich.',
    emoji: '🪙',
    kind: 'steigend',
    stepCents: 1,
    slots: 365,
    unit: 'tag',
  },
  {
    id: 'monat-50',
    name: '50 € im Monat',
    description: 'Ein Jahr lang jeden Monat fünfzig Euro zur Seite.',
    emoji: '🏦',
    kind: 'gleich',
    stepCents: 5000,
    slots: 12,
    unit: 'monat',
  },
]

/* --- Beträge -------------------------------------------------------------- */

export { slotAmount }

/**
 * Gesamtsumme aller Felder.
 *
 * Bei den gestaffelten Spielarten ist das die Gaußsche Summenformel:
 * Schritt × n × (n+1) / 2. Die Multiplikation kommt vor der Division, damit
 * ganze Cent herauskommen – n × (n+1) ist immer gerade, die Division geht also
 * ohne Rest auf.
 */
export function totalCents(challenge: Pick<Challenge, 'kind' | 'stepCents' | 'slots'>): number {
  const n = challenge.slots
  if (challenge.kind === 'gleich') return challenge.stepCents * n
  return (challenge.stepCents * n * (n + 1)) / 2
}

/** Was schon zurückgelegt wurde. */
export function savedCents(challenge: Challenge): number {
  let total = 0
  for (const slot of challenge.filled) total += slotAmount(challenge, slot)
  return total
}

export function remainingCents(challenge: Challenge): number {
  return Math.max(0, totalCents(challenge) - savedCents(challenge))
}

/** Fortschritt in Prozent, am Geld gemessen – nicht an der Zahl der Häkchen. */
export function progress(challenge: Challenge): number {
  const total = totalCents(challenge)
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((savedCents(challenge) / total) * 100)))
}

export function isComplete(challenge: Challenge): boolean {
  return challenge.filled.length >= challenge.slots
}

/* --- Zeit ----------------------------------------------------------------- */

/** Erster Tag, an dem Feld `slot` an der Reihe ist. */
export function slotDate(challenge: Challenge, slot: number): IsoDate {
  switch (challenge.unit) {
    case 'tag':
      return addDays(challenge.startDate, slot)
    case 'woche':
      return addDays(challenge.startDate, slot * 7)
    case 'monat': {
      const [year, month, day] = challenge.startDate.split('-')
      const shifted = addMonths(`${year}-${month}`, slot)
      // Der 31. eines Monats existiert nicht überall – dann der Monatsletzte.
      const { to } = monthEnd(shifted)
      return day && Number(day) <= Number(to.slice(-2)) ? `${shifted}-${day}` : to
    }
  }
}

function monthEnd(key: string): { to: IsoDate } {
  const parts = key.split('-').map(Number) as [number, number]
  const last = new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate()
  return { to: `${key}-${String(last).padStart(2, '0')}` }
}

/**
 * Wie viele Felder inzwischen fällig wären – unabhängig davon, ob sie abgehakt
 * sind. Bei `frei` gibt es keine Fälligkeit, dort zählt nur der Endtermin.
 */
export function dueCount(challenge: Challenge, now: IsoDate = today()): number {
  const elapsed = daysBetween(challenge.startDate, now)
  if (elapsed < 0) return 0
  const perSlot = challenge.unit === 'tag' ? 1 : challenge.unit === 'woche' ? 7 : 30
  return Math.min(challenge.slots, Math.floor(elapsed / perSlot) + 1)
}

/**
 * Steht die Challenge im Plan?
 *
 * `behind` ist die Zahl der Felder, die fällig wären, aber noch offen sind.
 * Bei `frei` wird nur die Anzahl verglichen, nicht welche Felder – dort ist die
 * Reihenfolge ja gerade freigestellt.
 */
export interface Pace {
  due: number
  done: number
  behind: number
  onTrack: boolean
}

export function pace(challenge: Challenge, now: IsoDate = today()): Pace {
  const due = dueCount(challenge, now)
  const done = challenge.filled.length
  const behind = Math.max(0, due - done)
  return { due, done, behind, onTrack: behind === 0 }
}

/**
 * Welches Feld als Nächstes drankommt.
 *
 * Bei `steigend` und `gleich` das erste offene der Reihe nach. Bei `frei` das
 * größte noch offene, das man sich leisten kann – wer früh die teuren Felder
 * wegräumt, scheitert später nicht an einem 52-€-Feld im Dezember. Ohne Budget
 * schlägt sie das kleinste offene Feld vor.
 */
export function suggestSlot(challenge: Challenge, budgetCents?: number): number | null {
  const open: number[] = []
  const filled = new Set(challenge.filled)
  for (let slot = 0; slot < challenge.slots; slot++) {
    if (!filled.has(slot)) open.push(slot)
  }
  if (open.length === 0) return null

  if (challenge.kind !== 'frei') return open[0]!

  if (budgetCents === undefined) {
    // Kleinstes offenes Feld – der niedrigschwellige Vorschlag.
    return open.reduce((best, slot) => (slotAmount(challenge, slot) < slotAmount(challenge, best) ? slot : best))
  }

  let best: number | null = null
  for (const slot of open) {
    const amount = slotAmount(challenge, slot)
    if (amount > budgetCents) continue
    if (best === null || amount > slotAmount(challenge, best)) best = slot
  }
  // Passt nichts ins Budget, bleibt das billigste Feld als Angebot.
  return best ?? open.reduce((a, b) => (slotAmount(challenge, a) <= slotAmount(challenge, b) ? a : b))
}

/** Alle Felder mit Betrag und Zustand – die Vorlage für das Raster. */
export interface Slot {
  index: number
  cents: number
  filled: boolean
  /** Fällig, aber noch offen. */
  overdue: boolean
  date: IsoDate
}

export function slots(challenge: Challenge, now: IsoDate = today()): Slot[] {
  const filled = new Set(challenge.filled)
  const due = challenge.kind === 'frei' ? 0 : dueCount(challenge, now)
  return Array.from({ length: challenge.slots }, (_, index) => ({
    index,
    cents: slotAmount(challenge, index),
    filled: filled.has(index),
    overdue: !filled.has(index) && index < due,
    date: slotDate(challenge, index),
  }))
}

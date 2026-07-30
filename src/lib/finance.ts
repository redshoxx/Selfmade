import { monthKey, today } from './date'
import { live } from './store'
import type { Category, Pot, PotEntry, State, Tx, TxKind } from './types'

/**
 * Auswertungen rund ums Geld.
 *
 * Alles rechnet in Cent und gibt Cent zurück. Gerundet wird erst bei der
 * Anzeige – sonst summieren sich Rundungsfehler über die Kategorien hinweg zu
 * Beträgen, die in keiner Zeile stehen.
 */

export interface MonthSummary {
  month: string
  incomeCents: number
  expenseCents: number
  /** Einnahmen minus Ausgaben. Negativ heißt: mehr raus als rein. */
  balanceCents: number
  /** Was tatsächlich in Spartöpfe ging. */
  savedCents: number
}

export function txsInMonth(state: State, month: string): Tx[] {
  return live(state.txs).filter((tx) => monthKey(tx.date) === month)
}

export function summarizeMonth(state: State, month: string): MonthSummary {
  let incomeCents = 0
  let expenseCents = 0
  for (const tx of txsInMonth(state, month)) {
    if (tx.kind === 'einnahme') incomeCents += tx.cents
    else expenseCents += tx.cents
  }

  let savedCents = 0
  for (const entry of live(state.potEntries)) {
    if (monthKey(entry.date) === month) savedCents += entry.cents
  }

  return {
    month,
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    savedCents,
  }
}

export interface CategoryTotal {
  category: Category | null
  cents: number
  /** Anteil an allen Ausgaben des Zeitraums, 0–100. */
  share: number
  /** Monatsbudget, falls gesetzt. */
  budgetCents: number | null
}

/**
 * Ausgaben (oder Einnahmen) eines Monats nach Kategorie, größte zuerst.
 *
 * Buchungen, deren Kategorie inzwischen gelöscht wurde, laufen unter
 * `category: null` mit. Sie einfach wegzulassen wäre schlimmer: Dann stimmte
 * die Summe der Kacheln nicht mehr mit der Monatssumme überein.
 */
export function totalsByCategory(state: State, month: string, kind: TxKind): CategoryTotal[] {
  const byCategory = new Map<string, number>()
  let total = 0
  for (const tx of txsInMonth(state, month)) {
    if (tx.kind !== kind) continue
    byCategory.set(tx.categoryId, (byCategory.get(tx.categoryId) ?? 0) + tx.cents)
    total += tx.cents
  }

  const out: CategoryTotal[] = []
  for (const [categoryId, cents] of byCategory) {
    const category = state.categories.find((c) => c.id === categoryId) ?? null
    out.push({
      category,
      cents,
      share: total > 0 ? Math.round((cents / total) * 100) : 0,
      budgetCents: category?.budgetCents ?? null,
    })
  }
  return out.sort((a, b) => b.cents - a.cents)
}

/** Kategorien mit Budget, die im Monat überzogen sind oder knapp werden. */
export interface BudgetStatus {
  category: Category
  spentCents: number
  budgetCents: number
  /** Kann über 100 liegen – genau das ist die interessante Auskunft. */
  usedPercent: number
  over: boolean
}

export function budgetStatus(state: State, month: string): BudgetStatus[] {
  const spent = new Map<string, number>()
  for (const tx of txsInMonth(state, month)) {
    if (tx.kind !== 'ausgabe') continue
    spent.set(tx.categoryId, (spent.get(tx.categoryId) ?? 0) + tx.cents)
  }

  const out: BudgetStatus[] = []
  for (const category of state.categories) {
    // Nur Ausgaben. Gezählt werden oben ausschließlich Ausgabe-Buchungen –
    // ein Budget auf einer Einnahme-Kategorie stünde also für immer bei 0 %
    // und sähe aus, als sei etwas kaputt.
    if (category.kind !== 'ausgabe') continue
    if (category.budgetCents === null || category.budgetCents <= 0) continue
    const spentCents = spent.get(category.id) ?? 0
    out.push({
      category,
      spentCents,
      budgetCents: category.budgetCents,
      usedPercent: Math.round((spentCents / category.budgetCents) * 100),
      over: spentCents > category.budgetCents,
    })
  }
  return out.sort((a, b) => b.usedPercent - a.usedPercent)
}

/* --- Sparen --------------------------------------------------------------- */

export interface PotStatus {
  pot: Pot
  /** Aktueller Stand: Einzahlungen minus Entnahmen. */
  savedCents: number
  /** 0–100; ohne Ziel immer 0. */
  progress: number
  /** Was bis zum Ziel fehlt; ohne Ziel `null`. */
  remainingCents: number | null
  reached: boolean
}

export function potStatus(state: State, pot: Pot): PotStatus {
  let savedCents = 0
  for (const entry of live(state.potEntries)) {
    if (entry.potId === pot.id) savedCents += entry.cents
  }

  const target = pot.targetCents
  if (target === null || target <= 0) {
    return { pot, savedCents, progress: 0, remainingCents: null, reached: false }
  }
  return {
    pot,
    savedCents,
    progress: Math.min(100, Math.max(0, Math.round((savedCents / target) * 100))),
    remainingCents: Math.max(0, target - savedCents),
    reached: savedCents >= target,
  }
}

export function allPotStatus(state: State): PotStatus[] {
  return live(state.pots).map((pot) => potStatus(state, pot))
}

/** Summe über alle Töpfe – der Betrag, den die Startseite als „gespart“ zeigt. */
export function totalSaved(state: State): number {
  let total = 0
  for (const entry of live(state.potEntries)) total += entry.cents
  return total
}

/** Einzahlungen eines Topfes, jüngste zuerst. */
export function potEntries(state: State, potId: string): PotEntry[] {
  return live(state.potEntries)
    .filter((entry) => entry.potId === potId)
    .sort((a, b) => (a.date === b.date ? b.updatedAt - a.updatedAt : b.date.localeCompare(a.date)))
}

/* --- Listen --------------------------------------------------------------- */

/** Buchungen, jüngste zuerst; bei gleichem Tag die zuletzt erfasste oben. */
export function sortedTxs(txs: readonly Tx[]): Tx[] {
  return [...txs].sort((a, b) => (a.date === b.date ? b.updatedAt - a.updatedAt : b.date.localeCompare(a.date)))
}

/** Nach Tag gruppiert – so liest sich eine Buchungsliste am schnellsten. */
export function groupByDay(txs: readonly Tx[]): { date: string; txs: Tx[]; netCents: number }[] {
  const groups = new Map<string, Tx[]>()
  for (const tx of sortedTxs(txs)) {
    const list = groups.get(tx.date)
    if (list) list.push(tx)
    else groups.set(tx.date, [tx])
  }
  return Array.from(groups, ([date, list]) => ({
    date,
    txs: list,
    netCents: list.reduce((sum, tx) => sum + (tx.kind === 'einnahme' ? tx.cents : -tx.cents), 0),
  }))
}

/**
 * Kategorien, die zuletzt am häufigsten benutzt wurden – für die Schnellwahl
 * beim Erfassen. Wer dreimal hintereinander „Lebensmittel“ gewählt hat, soll
 * beim vierten Mal nicht wieder durch die ganze Liste scrollen.
 */
export function frequentCategories(state: State, kind: TxKind, limit = 6): Category[] {
  const counts = new Map<string, number>()
  const recent = sortedTxs(live(state.txs)).slice(0, 60)
  for (const tx of recent) {
    if (tx.kind !== kind) continue
    counts.set(tx.categoryId, (counts.get(tx.categoryId) ?? 0) + 1)
  }

  const ranked = state.categories
    .filter((c) => c.kind === kind)
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
  return ranked.slice(0, limit)
}

/** Der Monat, den die App beim Öffnen zeigt. */
export function currentMonth(): string {
  return monthKey(today())
}

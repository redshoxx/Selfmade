import { addDays, daysInMonth, toDayNumber, today, type IsoDate } from './date'
import { live } from './store'
import type { RecurringTx, State } from './types'

/**
 * Wiederkehrende Buchungen.
 *
 * Miete, Abos, Gehalt – einmal angelegt, danach von selbst. Die Regel merkt
 * sich in `lastRun`, bis wohin schon gebucht wurde; alles danach wird beim
 * nächsten Öffnen nachgeholt. Wer die App zwei Monate nicht anfasst, bekommt
 * beide Buchungen – und keine doppelt.
 *
 * Gerechnet wird durchgehend über die Tagesfunktionen aus `date.ts`, nie über
 * Millisekunden: In den Umstellungsnächten hat ein Tag lokal 23 oder 25
 * Stunden, und eine Miete darf nicht deshalb am falschen Tag stehen.
 */

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Termin im Monat `year`-`month`, der zum Anker der Regel passt.
 *
 * Den 31. gibt es nicht in jedem Monat. Statt den Termin ausfallen zu lassen,
 * rutscht er auf den Monatsletzten – wer am 31. bucht, meint „am Monatsende“.
 */
function monthlyDate(year: number, month: number, anchorDay: number): IsoDate {
  const last = daysInMonth(year, month)
  return `${year}-${pad(month)}-${pad(Math.min(anchorDay, last))}`
}

/**
 * Alle Termine der Regel bis einschließlich `until`, die noch nicht gebucht
 * sind.
 *
 * Die Obergrenze von 400 Terminen ist eine Notbremse: Sie greift nur, wenn ein
 * Startdatum aus ferner Vergangenheit stammt, und verhindert, dass die App
 * beim ersten Öffnen tausende Buchungen anlegt.
 */
export function dueDates(rule: RecurringTx, until: IsoDate = today()): IsoDate[] {
  if (!rule.active || rule.deletedAt !== null) return []

  const limit = toDayNumber(until)
  // Nach `lastRun` weitermachen; beim ersten Lauf ab dem Startdatum.
  const after = rule.lastRun ? toDayNumber(rule.lastRun) : toDayNumber(rule.startDate) - 1
  if (limit <= after) return []

  const out: IsoDate[] = []

  if (rule.unit === 'woche') {
    // Vom Startdatum in Siebenerschritten – der Wochentag ergibt sich daraus
    // von selbst und muss nicht zusätzlich verwaltet werden.
    let date = rule.startDate
    while (toDayNumber(date) <= after) date = addDays(date, 7)
    while (toDayNumber(date) <= limit && out.length < 400) {
      out.push(date)
      date = addDays(date, 7)
    }
    return out
  }

  const parts = rule.startDate.split('-').map(Number) as [number, number, number]
  const [startYear, startMonth] = parts

  if (rule.unit === 'monat') {
    let year = startYear
    let month = startMonth
    while (out.length < 400) {
      const date = monthlyDate(year, month, rule.anchorDay)
      const day = toDayNumber(date)
      if (day > limit) break
      // Termine vor dem Start oder vor `lastRun` überspringen, ohne die
      // Schleife abzubrechen – der erste Monat kann davorliegen.
      if (day > after && day >= toDayNumber(rule.startDate)) out.push(date)
      month += 1
      if (month > 12) {
        month = 1
        year += 1
      }
    }
    return out
  }

  // jährlich
  const month = rule.anchorMonth ?? startMonth
  let year = startYear
  while (out.length < 400) {
    const date = monthlyDate(year, month, rule.anchorDay)
    const day = toDayNumber(date)
    if (day > limit) break
    if (day > after && day >= toDayNumber(rule.startDate)) out.push(date)
    year += 1
  }
  return out
}

/** Nächster Termin nach `from` – für die Anzeige „wieder am …“. */
export function nextDate(rule: RecurringTx, from: IsoDate = today()): IsoDate | null {
  if (!rule.active || rule.deletedAt !== null) return null

  const start = toDayNumber(rule.startDate)
  const anchor = Math.max(toDayNumber(from), rule.lastRun ? toDayNumber(rule.lastRun) + 1 : start)

  if (rule.unit === 'woche') {
    let date = rule.startDate
    while (toDayNumber(date) < anchor) date = addDays(date, 7)
    return date
  }

  const parts = rule.startDate.split('-').map(Number) as [number, number, number]
  const [startYear, startMonth] = parts

  if (rule.unit === 'monat') {
    let year = startYear
    let month = startMonth
    for (let i = 0; i < 400; i++) {
      const date = monthlyDate(year, month, rule.anchorDay)
      if (toDayNumber(date) >= anchor && toDayNumber(date) >= start) return date
      month += 1
      if (month > 12) {
        month = 1
        year += 1
      }
    }
    return null
  }

  const month = rule.anchorMonth ?? startMonth
  for (let year = startYear; year < startYear + 400; year++) {
    const date = monthlyDate(year, month, rule.anchorDay)
    if (toDayNumber(date) >= anchor && toDayNumber(date) >= start) return date
  }
  return null
}

/** Alle Regeln mit fälligen Terminen – das, was beim Start nachzubuchen ist. */
export function pendingRuns(state: Pick<State, 'recurringTxs'>, until: IsoDate = today()) {
  const out: { id: string; dates: IsoDate[] }[] = []
  for (const rule of live(state.recurringTxs)) {
    const dates = dueDates(rule, until)
    if (dates.length > 0) out.push({ id: rule.id, dates })
  }
  return out
}

const UNIT_LABEL: Record<RecurringTx['unit'], string> = {
  woche: 'wöchentlich',
  monat: 'monatlich',
  jahr: 'jährlich',
}

export function describeRule(rule: RecurringTx): string {
  if (rule.unit === 'monat') {
    return rule.anchorDay >= 29 ? 'monatlich zum Monatsende' : `monatlich am ${rule.anchorDay}.`
  }
  return UNIT_LABEL[rule.unit]
}

/**
 * Datum.
 *
 * Ein Tag ist hier eine Zeichenkette „JJJJ-MM-TT“ in *lokaler* Zeit, nie ein
 * Zeitstempel. Sonst wandert ein Mindesthaltbarkeitsdatum bei der Umstellung
 * auf Sommerzeit um einen Tag, und die App warnt am falschen Tag.
 *
 * Differenzen laufen über UTC-Mitternacht: Nur dort ist ein Tag verlässlich
 * 86 400 Sekunden lang. Die Umstellungsnächte haben lokal 23 bzw. 25 Stunden.
 */

export type IsoDate = string // JJJJ-MM-TT

const pad = (n: number) => String(n).padStart(2, '0')

/** Heutiger Tag in lokaler Zeit. */
export function today(now: Date = new Date()): IsoDate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parts = value.split('-').map(Number) as [number, number, number]
  const [y, m, d] = parts
  if (m < 1 || m > 12 || d < 1) return false
  return d <= daysInMonth(y, m)
}

export function daysInMonth(year: number, month: number): number {
  // Tag 0 des Folgemonats ist der letzte des gesuchten Monats.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Tage seit dem 1.1.1970, damit sich Daten ganzzahlig vergleichen lassen. */
export function toDayNumber(date: IsoDate): number {
  const parts = date.split('-').map(Number) as [number, number, number]
  const [y, m, d] = parts
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

export function fromDayNumber(day: number): IsoDate {
  const date = new Date(day * 86_400_000)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** Tage von `from` bis `to`; negativ, wenn `to` davor liegt. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(date) + days)
}

/** Monat einer Zeitangabe als „JJJJ-MM“ – Schlüssel für alle Monatssummen. */
export function monthKey(date: IsoDate): string {
  return date.slice(0, 7)
}

export function monthRange(key: string): { from: IsoDate; to: IsoDate } {
  const parts = key.split('-').map(Number) as [number, number]
  const [y, m] = parts
  return { from: `${key}-01`, to: `${key}-${pad(daysInMonth(y, m))}` }
}

export function addMonths(key: string, delta: number): string {
  const parts = key.split('-').map(Number) as [number, number]
  const [y, m] = parts
  const total = y * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

/** „März 2026“ */
export function formatMonth(key: string): string {
  const parts = key.split('-').map(Number) as [number, number]
  const [y, m] = parts
  return `${MONTHS[m - 1] ?? key} ${y}`
}

/**
 * „Aug 26“ – der Monatswechsel im Kopf.
 *
 * Kürzer als „August 2026“, weil dort links der Titel steht und rechts zwei
 * Pfeile: Auf 390 Punkten bleiben dazwischen keine neun Zeichen.
 */
export function formatMonthShort(key: string): string {
  const parts = key.split('-').map(Number) as [number, number]
  const [y, m] = parts
  return `${MONTHS[m - 1]?.slice(0, 3) ?? key} ${String(y).slice(-2)}`
}

/** „14.03.“ – kurz, für Listen. */
export function formatDayShort(date: IsoDate): string {
  const [, m, d] = date.split('-')
  return `${d}.${m}.`
}

/** „Fr, 14. März“ */
export function formatDayLong(date: IsoDate): string {
  const parts = date.split('-').map(Number) as [number, number, number]
  const [y, m, d] = parts
  const weekday = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${weekday}, ${d}. ${MONTHS[m - 1]}`
}

/**
 * „Freitag, 2. August“ – die Zeile über dem Gruß auf der Startseite.
 *
 * Dort steht der Wochentag ausgeschrieben, nicht als Kürzel: Es ist die einzige
 * Stelle, an der er allein steht und nicht neben einer Zahlenkolonne, in der
 * jedes Zeichen zählt.
 */
export function formatDayFull(date: IsoDate): string {
  const parts = date.split('-').map(Number) as [number, number, number]
  const [y, m, d] = parts
  const weekday = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][
    new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  ]
  return `${weekday}, ${d}. ${MONTHS[m - 1]}`
}

/**
 * Datum in Alltagssprache: „heute“, „gestern“, „morgen“, sonst das Datum.
 * Nur so weit, wie es wirklich hilft – „vorletzten Donnerstag“ versteht niemand
 * schneller als „12.03.“.
 */
export function formatRelative(date: IsoDate, from: IsoDate = today()): string {
  const diff = daysBetween(from, date)
  if (diff === 0) return 'heute'
  if (diff === 1) return 'morgen'
  if (diff === -1) return 'gestern'
  if (diff > 1 && diff <= 6) return `in ${diff} Tagen`
  if (diff < -1 && diff >= -6) return `vor ${Math.abs(diff)} Tagen`
  return formatDayShort(date)
}

/**
 * Restlaufzeit in zwei, drei Zeichen – für das Etikett am rechten Rand.
 *
 * `formatExpiry` schreibt ganze Sätze („noch bis morgen“). Die passen in eine
 * Unterzeile, nicht in ein Etikett von neun Pixeln Polster. Hier steht nur das
 * Wort, auf das es ankommt.
 */
export function expiryKurz(date: IsoDate, from: IsoDate = today()): string {
  const diff = daysBetween(from, date)
  if (diff < 0) return 'abgelaufen'
  if (diff === 0) return 'heute'
  if (diff === 1) return 'morgen'
  if (diff <= 13) return `${diff} Tage`
  if (diff <= 60) return `${Math.round(diff / 7)} Wochen`
  if (diff <= 400) return `${Math.round(diff / 30)} Monate`
  return formatDayShort(date)
}

/** Restlaufzeit eines Mindesthaltbarkeitsdatums in Worten. */
export function formatExpiry(date: IsoDate, from: IsoDate = today()): string {
  const diff = daysBetween(from, date)
  if (diff < -1) return `seit ${Math.abs(diff)} Tagen abgelaufen`
  if (diff === -1) return 'gestern abgelaufen'
  if (diff === 0) return 'läuft heute ab'
  // „morgen“ und „in 2 Tagen“ statt „noch bis morgen“ und „noch 2 Tage“:
  // Der Blick springt auf das Wort, das die Frist nennt, und das steht damit
  // vorn statt hinter einem Füllwort.
  if (diff === 1) return 'morgen'
  if (diff <= 13) return `in ${diff} Tagen`
  if (diff <= 60) return `in ${Math.round(diff / 7)} Wochen`
  if (diff <= 400) return `in ${Math.round(diff / 30)} Monaten`
  return `bis ${formatDayShort(date)}`
}

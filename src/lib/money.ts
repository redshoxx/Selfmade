/**
 * Geld.
 *
 * Beträge liegen ausnahmslos als ganzzahlige Cent vor. Fließkomma verbietet
 * sich: 0.1 + 0.2 ergibt 0.30000000000000004, und nach ein paar hundert
 * Buchungen steht in der Monatssumme ein Cent daneben, den niemand erklären
 * kann. Nur an der Oberfläche wird in Euro übersetzt.
 */

/** Obergrenze für einen einzelnen Betrag: 10 Mio. Euro. */
const MAX_CENTS = 1_000_000_000

export function isValidCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= MAX_CENTS
}

/**
 * Prüft den Vorkommateil.
 *
 * Entweder stehen dort nur Ziffern, oder die Trennzeichen gruppieren sauber in
 * Dreierblöcke – und zwar durchgehend dasselbe Zeichen. Sonst ist die Eingabe
 * mehrdeutig („12,3,4“) und wird lieber abgelehnt als geraten.
 */
function hasValidGrouping(whole: string): boolean {
  if (!whole.includes('.') && !whole.includes(',')) return /^\d*$/.test(whole)
  return /^\d{1,3}(\.\d{3})+$/.test(whole) || /^\d{1,3}(,\d{3})+$/.test(whole)
}

/**
 * Eingabe aus einem Textfeld in Cent.
 *
 * Verträgt, was Menschen tatsächlich tippen: „12,50“, „12.50“, „1.234,56“,
 * „1 234,56“, „12,5“, „12“, „€12,50“, „-3,20“. Gibt `null` zurück, wenn nichts
 * Sinnvolles herauszulesen ist – der Aufrufer entscheidet dann, ob er meckert.
 */
export function parseAmount(input: string): number | null {
  let text = input.trim()
  if (!text) return null

  // Währungszeichen und Leerraum (auch schmale/geschützte) fliegen raus.
  text = text.replace(/[€\s  ]/g, '')
  if (!text) return null

  let sign = 1
  if (text.startsWith('-')) {
    sign = -1
    text = text.slice(1)
  } else if (text.startsWith('+')) {
    text = text.slice(1)
  }

  if (!/^[\d.,]+$/.test(text)) return null

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  // Das *letzte* Trennzeichen entscheidet, ob es Dezimal- oder Tausendertrenner
  // ist: „1.234,56“ (Komma gewinnt) gegen „1,234.56“ (Punkt gewinnt).
  const decimalAt = Math.max(lastComma, lastDot)

  let whole: string
  let frac: string

  if (decimalAt === -1) {
    whole = text
    frac = ''
  } else {
    const separator = text[decimalAt]
    const tail = text.slice(decimalAt + 1)
    // Genau eine Nachkommastelle oder zwei heißt Dezimaltrenner. Drei Stellen
    // ohne weiteres Trennzeichen sind ein Tausenderpunkt („1.234“).
    const isDecimal = tail.length <= 2 && !tail.includes('.') && !tail.includes(',')
    if (isDecimal) {
      whole = text.slice(0, decimalAt)
      frac = tail
    } else if (separator === '.' || separator === ',') {
      whole = text
      frac = ''
    } else {
      return null
    }
  }

  if (!hasValidGrouping(whole)) return null
  // Übrige Trennzeichen im Vorkommateil sind Tausenderpunkte.
  whole = whole.replace(/[.,]/g, '')
  if (whole === '' && frac === '') return null
  if (!/^\d*$/.test(frac)) return null

  const euros = whole === '' ? 0 : Number(whole)
  const cents = frac === '' ? 0 : Number(frac.padEnd(2, '0'))
  if (!Number.isFinite(euros) || !Number.isFinite(cents)) return null

  const total = sign * (euros * 100 + cents)
  if (!Number.isSafeInteger(total) || Math.abs(total) > MAX_CENTS) return null
  return total
}

const nf = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const nfPlain = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** „1.234,56 €“ */
export function formatMoney(cents: number): string {
  return nf.format(cents / 100)
}

/** „1.234,56“ – ohne Währungszeichen, für Eingabefelder und enge Spalten. */
export function formatPlain(cents: number): string {
  return nfPlain.format(cents / 100)
}

/**
 * Kurzform für Kacheln: „1.234 €“ statt „1.234,56 €“, wenn der Cent-Anteil
 * für die Aussage egal ist. Runde Beträge bleiben rund.
 */
export function formatShort(cents: number): string {
  const euros = Math.round(cents / 100)
  return `${new Intl.NumberFormat('de-DE').format(euros)} €`
}

/** Vorzeichenbehaftet, für Buchungslisten: „+120,00 €“ / „−45,90 €“. */
export function formatSigned(cents: number): string {
  if (cents === 0) return formatMoney(0)
  // Echtes Minuszeichen statt Bindestrich – liest sich in einer Zahlenspalte ruhiger.
  return `${cents > 0 ? '+' : '−'}${formatMoney(Math.abs(cents))}`
}

/** Anteil in Prozent, auf 0–100 begrenzt. Nenner 0 ergibt 0. */
export function percent(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((part / total) * 100)))
}

/** Summiert sicher; alles, was kein gültiger Betrag ist, zählt als 0. */
export function sumCents(values: readonly number[]): number {
  let total = 0
  for (const value of values) if (isValidCents(value)) total += value
  return total
}

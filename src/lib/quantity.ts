/**
 * Mengen auf der Einkaufsliste.
 *
 * Wer etwas aufschreibt, tippt „2 Milch“ – nicht „Milch“, dann Eintrag öffnen,
 * dann ins Mengenfeld, dann tippen, dann zurück. Diese Datei trennt beim
 * Erfassen die Menge vom Namen, damit ein Handgriff genügt.
 *
 * Die Menge bleibt bewusst **Freitext**. „1 Packung“ und „500 g“ lassen sich
 * nicht in eine Zahl pressen, und ein Modellbruch wäre den Gewinn nicht wert.
 */

/**
 * Einheiten, die im Alltag vor oder hinter einer Zahl stehen.
 *
 * Die Schreibweise, die hier steht, ist die, die später angezeigt wird –
 * aus „500G“ wird „500 g“, aus „2 stk“ wird „2 Stück“.
 */
const UNITS: readonly { match: readonly string[]; label: string }[] = [
  { match: ['g', 'gr', 'gramm'], label: 'g' },
  { match: ['kg', 'kilo', 'kilogramm'], label: 'kg' },
  { match: ['mg'], label: 'mg' },
  { match: ['ml'], label: 'ml' },
  { match: ['l', 'liter', 'ltr'], label: 'l' },
  { match: ['cl'], label: 'cl' },
  { match: ['stk', 'stück', 'stueck', 'st'], label: 'Stück' },
  { match: ['pck', 'pkg', 'packung', 'packungen', 'pack'], label: 'Packung' },
  { match: ['dose', 'dosen'], label: 'Dose' },
  { match: ['flasche', 'flaschen', 'fl'], label: 'Flasche' },
  { match: ['glas', 'gläser', 'glaeser'], label: 'Glas' },
  { match: ['becher'], label: 'Becher' },
  { match: ['bund'], label: 'Bund' },
  { match: ['scheibe', 'scheiben'], label: 'Scheiben' },
  { match: ['rolle', 'rollen'], label: 'Rolle' },
  { match: ['tüte', 'tueten', 'tüten'], label: 'Tüte' },
  { match: ['beutel'], label: 'Beutel' },
  { match: ['karton', 'kiste'], label: 'Kiste' },
  { match: ['portion', 'portionen'], label: 'Portionen' },
]

const UNIT_LOOKUP = new Map<string, string>()
for (const unit of UNITS) {
  for (const spelling of unit.match) UNIT_LOOKUP.set(spelling, unit.label)
}

export interface ParsedEntry {
  name: string
  /** Leer, wenn keine Menge erkannt wurde. */
  qty: string
}

/** Zahl in deutscher Schreibweise ausgeben: 1.5 → „1,5“, 2 → „2“. */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',')
}

function toNumber(text: string): number | null {
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : null
}

/** Menge und Einheit zu einer Anzeige zusammensetzen. */
function compose(amount: number, unit: string | null): string {
  return unit ? `${formatNumber(amount)} ${unit}` : formatNumber(amount)
}

/**
 * Trennt Menge und Name.
 *
 * Erkannt wird, was Menschen tatsächlich tippen:
 *
 *   „2 Milch“ · „500g Mehl“ · „1,5 l Milch“ · „3x Joghurt“ · „Milch 2“
 *
 * Bewusst **nicht** erkannt wird alles, was zwar mit einer Zahl zu tun hat,
 * aber keine Menge ist: „H-Milch 3,5 %“, „0 % Joghurt“, „Vitamin B12“,
 * „Nr. 5“. Eine falsch erkannte Menge ist schlimmer als gar keine – sie
 * verstümmelt den Namen, und das fällt erst im Laden auf.
 */
export function parseEntry(input: string): ParsedEntry {
  const text = input.trim().replace(/\s+/g, ' ')
  if (!text) return { name: '', qty: '' }

  // Ein Prozentzeichen macht die Zahl zur Produktangabe, nicht zur Menge:
  // „H-Milch 3,5 %“, „0 % Joghurt“.
  if (text.includes('%')) return { name: text, qty: '' }

  const number = '\\d+(?:[.,]\\d+)?'

  // 1. Menge vorn: „2 Milch“, „500g Mehl“, „1,5 l Milch“, „3x Joghurt“
  const leading = text.match(new RegExp(`^(${number})\\s*([a-zA-ZäöüÄÖÜß]+)?\\.?\\s*(?:x\\s*)?(.*)$`))
  if (leading) {
    const [, rawAmount, rawUnit, rest] = leading
    const amount = toNumber(rawAmount!)
    const trailing = (rest ?? '').trim()

    if (amount !== null) {
      const unitKey = rawUnit?.toLowerCase()
      const unit = unitKey ? UNIT_LOOKUP.get(unitKey) : undefined

      // „3x Joghurt“ – das x zählt, es ist keine Einheit und kein Name.
      if (unitKey === 'x' && trailing) return { name: trailing, qty: compose(amount, null) }
      // „500g Mehl“ – Einheit erkannt, dahinter steht der Name.
      if (unit && trailing) return { name: trailing, qty: compose(amount, unit) }
      // „2 Milch“ – zwischen Zahl und Name stand nichts.
      if (!rawUnit && trailing) return { name: trailing, qty: compose(amount, null) }
      // „2 Packungen“ ohne Namen: Das ist der Name, keine Menge – sonst bliebe
      // ein Eintrag ohne Bezeichnung übrig.
      if (unit && !trailing) return { name: text, qty: '' }
      // „2 Milch“ – was nach der Zahl kommt, ist keine Einheit, also der Name.
      if (rawUnit && !unit) {
        const name = [rawUnit, trailing].filter(Boolean).join(' ')
        return { name, qty: compose(amount, null) }
      }
    }
  }

  // 2. Menge hinten: „Milch 2“, „Mehl 500 g“
  const tail = text.match(new RegExp(`^(.*?)\\s+(${number})\\s*([a-zA-ZäöüÄÖÜß]+)?$`))
  if (tail) {
    const [, rawName, rawAmount, rawUnit] = tail
    const amount = toNumber(rawAmount!)
    const name = (rawName ?? '').trim()
    const unitKey = rawUnit?.toLowerCase()
    const unit = unitKey ? UNIT_LOOKUP.get(unitKey) : undefined

    // Ohne Namen bliebe nichts übrig; eine unbekannte Endung wie „B12“ gehört
    // zum Produkt und ist keine Einheit.
    if (name && amount !== null && (!rawUnit || unit)) {
      return { name, qty: compose(amount, unit ?? null) }
    }
  }

  return { name: text, qty: '' }
}

/**
 * Eine Freitext-Menge in Zahl und Einheit zerlegen.
 *
 * `"500 g"` → `{ amount: 500, unit: 'g' }`, `"2"` → `{ amount: 2, unit: '' }`,
 * `"ein Karton"` → `null`.
 *
 * Steht hier und nicht dort, wo sie gebraucht wird: Der Vorrat rechnet mit
 * Zahlen, die Liste mit Freitext, und zwischen beiden muss übersetzt werden.
 * Ein zweiter Parser daneben würde unweigerlich anders raten als dieser – und
 * dann zählte der Vorrat etwas anderes hoch, als auf der Liste stand.
 */
export function splitQuantity(text: string): { amount: number; unit: string } | null {
  const match = text.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
  if (!match) return null
  const amount = Number(match[1]!.replace(',', '.'))
  if (!Number.isFinite(amount)) return null
  return { amount, unit: match[2]!.trim() }
}

/**
 * Menge um `delta` verändern – für die −/+ Schaltflächen in der Liste.
 *
 * Greift nur, wenn die Menge mit einer Zahl beginnt. Bei „1 Packung“ zählt die
 * Zahl, die Einheit bleibt stehen. Eine leere Menge zählt als 1, damit ein
 * Tipp auf „+“ zu „2“ führt und nicht ins Leere.
 *
 * Unter 1 wird nicht gezählt: Wer nichts mehr braucht, streicht den Eintrag,
 * statt „0 Milch“ auf der Liste stehen zu lassen.
 */
export function bumpQuantity(qty: string, delta: number): string {
  const text = qty.trim()
  if (!text) return delta > 0 ? '2' : '1'

  const match = text.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
  if (!match) return text // „ein Karton“ – daran lässt sich nichts drehen

  const current = Number(match[1]!.replace(',', '.'))
  if (!Number.isFinite(current)) return text

  // Bei ganzen Zahlen in Einerschritten, bei „1,5 l“ in Halben – alles andere
  // führt zu Mengen wie „1,5000000000000002“.
  const step = Number.isInteger(current) ? 1 : 0.5
  const next = Math.round((current + delta * step) * 100) / 100
  if (next < 1) return text

  const unit = match[2]!.trim()
  return unit ? `${formatNumber(next)} ${unit}` : formatNumber(next)
}

/** Lässt sich diese Menge mit −/+ verändern? */
export function isBumpable(qty: string): boolean {
  return qty.trim() === '' || /^\d/.test(qty.trim())
}

/**
 * Zwei Mengen desselben Produkts zusammenzählen.
 *
 * Steht „2 Milch“ schon auf der Liste und jemand schreibt „1 Milch“ dazu,
 * sollen daraus „3“ werden – nicht zwei Zeilen mit demselben Wort.
 *
 * Passen die Einheiten nicht zusammen („500 g“ und „2 Packung“), gewinnt die
 * vorhandene Angabe. Umrechnen wäre geraten, und geraten wird hier nicht.
 */
export function mergeQuantities(existing: string, added: string): string {
  const a = existing.trim()
  const b = added.trim()
  if (!a) return b
  if (!b) return a

  // Kleingeschrieben vergleichen: „2 Packung“ und „2 packung“ sind dasselbe.
  const left = splitQuantity(a)
  const right = splitQuantity(b)
  if (!left || !right || left.unit.toLowerCase() !== right.unit.toLowerCase()) return a

  const total = Math.round((left.amount + right.amount) * 100) / 100
  const unit = a.match(/^\d+(?:[.,]\d+)?\s*(.*)$/)?.[1]?.trim() ?? ''
  return unit ? `${formatNumber(total)} ${unit}` : formatNumber(total)
}

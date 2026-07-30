import { describe, expect, it } from 'vitest'
import { formatMoney, formatSigned, parseAmount, percent, sumCents } from './money'

describe('parseAmount', () => {
  it('liest die deutsche Schreibweise', () => {
    expect(parseAmount('12,50')).toBe(1250)
    expect(parseAmount('0,99')).toBe(99)
    expect(parseAmount('1.234,56')).toBe(123456)
    expect(parseAmount('1234,5')).toBe(123450)
  })

  it('liest die englische Schreibweise', () => {
    expect(parseAmount('12.50')).toBe(1250)
    expect(parseAmount('1,234.56')).toBe(123456)
  })

  it('nimmt ganze Zahlen ohne Trennzeichen', () => {
    expect(parseAmount('12')).toBe(1200)
    expect(parseAmount('0')).toBe(0)
  })

  it('deutet drei Stellen hinter dem Punkt als Tausender', () => {
    // „1.234“ ist tausendzweihundertvierunddreißig Euro, nicht 1,234 Euro.
    expect(parseAmount('1.234')).toBe(123400)
    expect(parseAmount('1,234')).toBe(123400)
  })

  it('verträgt Währungszeichen, Leerraum und Vorzeichen', () => {
    expect(parseAmount(' €12,50 ')).toBe(1250)
    expect(parseAmount('12,50 €')).toBe(1250)
    expect(parseAmount('1 234,56')).toBe(123456)
    expect(parseAmount('-3,20')).toBe(-320)
    expect(parseAmount('+3,20')).toBe(320)
  })

  it('gibt null bei Unsinn', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('   ')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('12,3,4')).toBeNull()
    expect(parseAmount('€')).toBeNull()
    expect(parseAmount('99999999999')).toBeNull()
  })

  it('rechnet ohne Fließkomma-Rundungsfehler', () => {
    // Der klassische Fall: 0,1 + 0,2 als Fließkomma ergibt 0,30000000000000004.
    expect(parseAmount('0,10')! + parseAmount('0,20')!).toBe(30)
    // 8,20 € landet als Fließkomma gern bei 819,9999…
    expect(parseAmount('8,20')).toBe(820)
    expect(parseAmount('114,95')).toBe(11495)
  })
})

describe('formatMoney', () => {
  it('schreibt mit zwei Nachkommastellen und Währung', () => {
    // Geschütztes Leerzeichen vor dem €, deshalb kein harter Vergleich.
    expect(formatMoney(1250)).toMatch(/^12,50\s*€$/)
    expect(formatMoney(0)).toMatch(/^0,00\s*€$/)
    expect(formatMoney(123456)).toMatch(/^1\.234,56\s*€$/)
  })

  it('setzt bei formatSigned ein echtes Vorzeichen', () => {
    expect(formatSigned(1250).startsWith('+')).toBe(true)
    expect(formatSigned(-1250).startsWith('−')).toBe(true)
    expect(formatSigned(0).startsWith('+')).toBe(false)
  })
})

describe('percent', () => {
  it('rechnet Anteile und bleibt zwischen 0 und 100', () => {
    expect(percent(50, 200)).toBe(25)
    expect(percent(0, 200)).toBe(0)
    expect(percent(300, 200)).toBe(100)
    expect(percent(-5, 200)).toBe(0)
  })

  it('verträgt den Nenner 0', () => {
    expect(percent(10, 0)).toBe(0)
  })
})

describe('sumCents', () => {
  it('summiert und überspringt Ungültiges', () => {
    expect(sumCents([100, 250, 3])).toBe(353)
    expect(sumCents([])).toBe(0)
    expect(sumCents([100, NaN, 1.5, 50])).toBe(150)
  })
})

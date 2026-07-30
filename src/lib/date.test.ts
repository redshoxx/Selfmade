import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  formatExpiry,
  formatMonth,
  formatRelative,
  isIsoDate,
  monthKey,
  monthRange,
  today,
} from './date'

describe('today', () => {
  it('nimmt die lokalen Datumsteile, nicht UTC', () => {
    // Kurz vor Mitternacht Ortszeit ist es in UTC schon der Folgetag – hier muss
    // trotzdem der lokale Tag herauskommen, sonst rutschen Buchungen in
    // den falschen Tag.
    expect(today(new Date(2026, 2, 14, 23, 30))).toBe('2026-03-14')
    expect(today(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
  })
})

describe('isIsoDate', () => {
  it('erkennt gültige Daten', () => {
    expect(isIsoDate('2026-03-14')).toBe(true)
    expect(isIsoDate('2024-02-29')).toBe(true) // Schaltjahr
  })

  it('lehnt Unsinn ab', () => {
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2025-02-29')).toBe(false) // kein Schaltjahr
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('2026-00-10')).toBe(false)
    expect(isIsoDate('14.03.2026')).toBe(false)
    expect(isIsoDate('')).toBe(false)
    expect(isIsoDate(null)).toBe(false)
  })
})

describe('daysInMonth', () => {
  it('kennt die Monatslängen inklusive Schaltjahr', () => {
    expect(daysInMonth(2026, 1)).toBe(31)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2000, 2)).toBe(29) // durch 400 teilbar
    expect(daysInMonth(1900, 2)).toBe(28) // durch 100, nicht durch 400
  })
})

describe('daysBetween / addDays', () => {
  it('zählt Tage über Monats- und Jahresgrenzen', () => {
    expect(daysBetween('2026-03-14', '2026-03-16')).toBe(2)
    expect(daysBetween('2026-03-16', '2026-03-14')).toBe(-2)
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0)
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2) // Schaltjahr
  })

  it('bleibt über die Zeitumstellung hinweg richtig', () => {
    // In Deutschland: Sommerzeit ab 29.03.2026, Winterzeit ab 25.10.2026.
    // Diese Nächte haben lokal 23 bzw. 25 Stunden – naive Millisekunden-
    // Rechnung zählt hier einen Tag zu wenig oder zu viel.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })

  it('rechnet vorwärts und rückwärts', () => {
    expect(addDays('2026-03-14', 20)).toBe('2026-04-03')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('Monate', () => {
  it('schlüsselt und begrenzt', () => {
    expect(monthKey('2026-03-14')).toBe('2026-03')
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' })
  })

  it('rechnet über Jahresgrenzen', () => {
    expect(addMonths('2026-03', 1)).toBe('2026-04')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-06', -12)).toBe('2025-06')
  })

  it('schreibt den Monat aus', () => {
    expect(formatMonth('2026-03')).toBe('März 2026')
  })
})

describe('formatRelative', () => {
  it('bevorzugt Alltagsworte in der nahen Umgebung', () => {
    const heute = '2026-03-14'
    expect(formatRelative('2026-03-14', heute)).toBe('heute')
    expect(formatRelative('2026-03-15', heute)).toBe('morgen')
    expect(formatRelative('2026-03-13', heute)).toBe('gestern')
    expect(formatRelative('2026-03-17', heute)).toBe('in 3 Tagen')
    expect(formatRelative('2026-03-11', heute)).toBe('vor 3 Tagen')
  })

  it('nennt weiter entfernt das Datum', () => {
    expect(formatRelative('2026-04-20', '2026-03-14')).toBe('20.04.')
  })
})

describe('formatExpiry', () => {
  it('sagt klar, wie es um das Produkt steht', () => {
    const heute = '2026-03-14'
    expect(formatExpiry('2026-03-14', heute)).toBe('läuft heute ab')
    expect(formatExpiry('2026-03-15', heute)).toBe('noch bis morgen')
    expect(formatExpiry('2026-03-13', heute)).toBe('gestern abgelaufen')
    expect(formatExpiry('2026-03-10', heute)).toBe('seit 4 Tagen abgelaufen')
    expect(formatExpiry('2026-03-20', heute)).toBe('noch 6 Tage')
    expect(formatExpiry('2026-04-04', heute)).toBe('noch 3 Wochen')
    expect(formatExpiry('2026-09-01', heute)).toBe('bis 01.09.')
  })
})

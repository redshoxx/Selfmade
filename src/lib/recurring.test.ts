import { describe, expect, it } from 'vitest'
import { describeRule, dueDates, nextDate, pendingRuns } from './recurring'
import { initialState, reducer } from './store'
import type { RecurringTx } from './types'

function rule(over: Partial<RecurringTx> = {}): RecurringTx {
  return {
    id: 'r1',
    updatedAt: 1,
    deletedAt: null,
    kind: 'ausgabe',
    cents: 89000,
    categoryId: 'cat-wohnen',
    note: 'Miete',
    unit: 'monat',
    anchorDay: 1,
    anchorMonth: null,
    startDate: '2026-01-01',
    lastRun: null,
    active: true,
    ...over,
  }
}

describe('dueDates – monatlich', () => {
  it('bucht ab dem Startdatum', () => {
    expect(dueDates(rule(), '2026-01-01')).toEqual(['2026-01-01'])
  })

  it('bucht vor dem Startdatum nichts', () => {
    expect(dueDates(rule({ startDate: '2026-05-01' }), '2026-01-15')).toEqual([])
  })

  it('holt eine lange Pause vollständig nach', () => {
    // Wer die App zwei Monate nicht öffnet, bekommt beide Buchungen.
    expect(dueDates(rule({ lastRun: '2026-01-01' }), '2026-03-15')).toEqual([
      '2026-02-01',
      '2026-03-01',
    ])
  })

  it('bucht keinen Termin zweimal', () => {
    // Nach dem Lauf bis Februar darf Februar nicht noch einmal kommen.
    expect(dueDates(rule({ lastRun: '2026-02-01' }), '2026-02-20')).toEqual([])
  })

  it('rutscht in kurzen Monaten auf den Monatsletzten', () => {
    // Den 31. Februar gibt es nicht – gemeint ist das Monatsende.
    const monatsende = rule({ anchorDay: 31, startDate: '2026-01-31' })
    expect(dueDates(monatsende, '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
  })

  it('trifft den 29. Februar im Schaltjahr', () => {
    const r = rule({ anchorDay: 29, startDate: '2024-01-29' })
    expect(dueDates(r, '2024-03-01')).toContain('2024-02-29')
  })

  it('läuft über den Jahreswechsel', () => {
    expect(dueDates(rule({ lastRun: '2026-11-01' }), '2027-01-15')).toEqual([
      '2026-12-01',
      '2027-01-01',
    ])
  })
})

describe('dueDates – wöchentlich', () => {
  it('zählt in Siebenerschritten ab dem Start', () => {
    const r = rule({ unit: 'woche', startDate: '2026-01-05' })
    expect(dueDates(r, '2026-01-26')).toEqual([
      '2026-01-05',
      '2026-01-12',
      '2026-01-19',
      '2026-01-26',
    ])
  })

  it('bleibt über die Zeitumstellung hinweg richtig', () => {
    // Sommerzeit beginnt am 29.03.2026 – diese Nacht hat lokal 23 Stunden.
    // Über Millisekunden gerechnet läge der Folgetermin einen Tag daneben.
    const r = rule({ unit: 'woche', startDate: '2026-03-22', lastRun: '2026-03-22' })
    expect(dueDates(r, '2026-04-05')).toEqual(['2026-03-29', '2026-04-05'])
  })
})

describe('dueDates – jährlich', () => {
  it('bucht einmal im Jahr', () => {
    const r = rule({ unit: 'jahr', anchorDay: 15, anchorMonth: 6, startDate: '2024-06-15' })
    expect(dueDates(r, '2026-12-31')).toEqual(['2024-06-15', '2025-06-15', '2026-06-15'])
  })
})

describe('dueDates – Randfälle', () => {
  it('schweigt bei stillgelegten und gelöschten Regeln', () => {
    expect(dueDates(rule({ active: false }), '2026-06-01')).toEqual([])
    expect(dueDates(rule({ deletedAt: 123 }), '2026-06-01')).toEqual([])
  })

  it('legt bei uraltem Startdatum nicht endlos Buchungen an', () => {
    // Notbremse: sonst entstünden beim ersten Öffnen tausende Einträge.
    const dates = dueDates(rule({ startDate: '1900-01-01' }), '2026-01-01')
    expect(dates.length).toBeLessThanOrEqual(400)
  })
})

describe('nextDate', () => {
  it('nennt den nächsten Termin', () => {
    expect(nextDate(rule({ lastRun: '2026-01-01' }), '2026-01-15')).toBe('2026-02-01')
    expect(nextDate(rule({ unit: 'woche', startDate: '2026-01-05' }), '2026-01-06')).toBe('2026-01-12')
  })

  it('nennt bei noch nicht begonnenen Regeln den Start', () => {
    expect(nextDate(rule({ startDate: '2026-09-01' }), '2026-01-01')).toBe('2026-09-01')
  })

  it('schweigt bei stillgelegten Regeln', () => {
    expect(nextDate(rule({ active: false }), '2026-01-01')).toBeNull()
  })
})

describe('pendingRuns und recurring/run', () => {
  it('führt fällige Regeln auf', () => {
    const state = { ...initialState(), recurringTxs: [rule({ lastRun: '2026-01-01' })] }
    const pending = pendingRuns(state, '2026-03-15')
    expect(pending).toHaveLength(1)
    expect(pending[0]!.dates).toEqual(['2026-02-01', '2026-03-01'])
  })

  it('legt die Buchungen an und zieht lastRun nach', () => {
    let state = { ...initialState(), recurringTxs: [rule({ lastRun: '2026-01-01' })] }
    state = reducer(state, { type: 'recurring/run', id: 'r1', dates: ['2026-02-01', '2026-03-01'] })

    expect(state.txs).toHaveLength(2)
    expect(state.txs.every((tx) => tx.recurring)).toBe(true)
    expect(state.txs.every((tx) => tx.cents === 89000)).toBe(true)
    // Ohne das Nachziehen entstünden beim nächsten Start dieselben Buchungen.
    expect(state.recurringTxs[0]!.lastRun).toBe('2026-03-01')
  })

  it('bucht nach dem Lauf nichts mehr nach', () => {
    let state = { ...initialState(), recurringTxs: [rule({ lastRun: '2026-01-01' })] }
    for (const run of pendingRuns(state, '2026-03-15')) {
      state = reducer(state, { type: 'recurring/run', id: run.id, dates: run.dates })
    }
    expect(pendingRuns(state, '2026-03-15')).toEqual([])
    expect(state.txs).toHaveLength(2)
  })

  it('lässt eine unbekannte Regel den Zustand unberührt', () => {
    const state = { ...initialState(), recurringTxs: [rule()] }
    expect(reducer(state, { type: 'recurring/run', id: 'gibtsnicht', dates: ['2026-01-01'] })).toBe(state)
    expect(reducer(state, { type: 'recurring/run', id: 'r1', dates: [] })).toBe(state)
  })
})

describe('describeRule', () => {
  it('beschreibt den Rhythmus in Worten', () => {
    expect(describeRule(rule({ anchorDay: 3 }))).toBe('monatlich am 3.')
    expect(describeRule(rule({ anchorDay: 31 }))).toBe('monatlich zum Monatsende')
    expect(describeRule(rule({ unit: 'woche' }))).toBe('wöchentlich')
    expect(describeRule(rule({ unit: 'jahr' }))).toBe('jährlich')
  })
})

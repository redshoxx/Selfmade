import { describe, expect, it } from 'vitest'
import {
  allPotStatus,
  budgetStatus,
  frequentCategories,
  groupByDay,
  potStatus,
  summarizeMonth,
  totalSaved,
  totalsByCategory,
} from './finance'
import { initialState } from './store'
import type { Pot, PotEntry, State, Tx } from './types'

function tx(over: Partial<Tx> & Pick<Tx, 'id'>): Tx {
  return {
    updatedAt: 1,
    deletedAt: null,
    kind: 'ausgabe',
    cents: 1000,
    categoryId: 'cat-lebensmittel',
    note: '',
    date: '2026-03-14',
    recurring: false,
    ...over,
  }
}

function stateWith(txs: Tx[], over: Partial<State> = {}): State {
  return { ...initialState(), txs, ...over }
}

describe('summarizeMonth', () => {
  it('trennt Einnahmen von Ausgaben und zieht den Saldo', () => {
    const state = stateWith([
      tx({ id: '1', kind: 'einnahme', cents: 250000, categoryId: 'cat-lohn' }),
      tx({ id: '2', kind: 'ausgabe', cents: 80000, categoryId: 'cat-wohnen' }),
      tx({ id: '3', kind: 'ausgabe', cents: 12550 }),
    ])
    const s = summarizeMonth(state, '2026-03')
    expect(s.incomeCents).toBe(250000)
    expect(s.expenseCents).toBe(92550)
    expect(s.balanceCents).toBe(157450)
  })

  it('lässt andere Monate und gelöschte Buchungen außen vor', () => {
    const state = stateWith([
      tx({ id: '1', cents: 1000 }),
      tx({ id: '2', cents: 5000, date: '2026-02-28' }),
      tx({ id: '3', cents: 9999, deletedAt: 12345 }),
    ])
    expect(summarizeMonth(state, '2026-03').expenseCents).toBe(1000)
  })

  it('zählt das Gesparte des Monats mit', () => {
    const entries: PotEntry[] = [
      { id: 'e1', updatedAt: 1, deletedAt: null, potId: 'p', cents: 5000, date: '2026-03-02', note: '', challengeId: null, slot: null },
      { id: 'e2', updatedAt: 1, deletedAt: null, potId: 'p', cents: 2000, date: '2026-02-02', note: '', challengeId: null, slot: null },
    ]
    expect(summarizeMonth(stateWith([], { potEntries: entries }), '2026-03').savedCents).toBe(5000)
  })

  it('bleibt bei einem leeren Monat bei null', () => {
    const s = summarizeMonth(initialState(), '2026-03')
    expect(s).toMatchObject({ incomeCents: 0, expenseCents: 0, balanceCents: 0, savedCents: 0 })
  })
})

describe('totalsByCategory', () => {
  it('summiert je Kategorie, größte zuerst, mit Anteil', () => {
    const state = stateWith([
      tx({ id: '1', cents: 3000, categoryId: 'cat-lebensmittel' }),
      tx({ id: '2', cents: 1000, categoryId: 'cat-lebensmittel' }),
      tx({ id: '3', cents: 6000, categoryId: 'cat-wohnen' }),
    ])
    const totals = totalsByCategory(state, '2026-03', 'ausgabe')
    expect(totals[0]!.category!.id).toBe('cat-wohnen')
    expect(totals[0]!.cents).toBe(6000)
    expect(totals[0]!.share).toBe(60)
    expect(totals[1]!.cents).toBe(4000)
    expect(totals[1]!.share).toBe(40)
  })

  it('behält Buchungen ohne bekannte Kategorie in der Summe', () => {
    // Sonst wichen die Kacheln von der Monatssumme ab, ohne dass man sähe warum.
    const state = stateWith([tx({ id: '1', cents: 2500, categoryId: 'geloescht' })])
    const totals = totalsByCategory(state, '2026-03', 'ausgabe')
    expect(totals).toHaveLength(1)
    expect(totals[0]!.category).toBeNull()
    expect(totals[0]!.cents).toBe(2500)
  })
})

describe('budgetStatus', () => {
  it('meldet Überziehung und Auslastung', () => {
    const state = stateWith(
      [
        tx({ id: '1', cents: 45000, categoryId: 'cat-lebensmittel' }),
        tx({ id: '2', cents: 10000, categoryId: 'cat-freizeit' }),
      ],
      {
        categories: initialState().categories.map((c) =>
          c.id === 'cat-lebensmittel'
            ? { ...c, budgetCents: 40000 }
            : c.id === 'cat-freizeit'
              ? { ...c, budgetCents: 20000 }
              : c,
        ),
      },
    )
    const status = budgetStatus(state, '2026-03')
    expect(status[0]!.category.id).toBe('cat-lebensmittel')
    expect(status[0]!.usedPercent).toBe(113)
    expect(status[0]!.over).toBe(true)
    expect(status[1]!.usedPercent).toBe(50)
    expect(status[1]!.over).toBe(false)
  })

  it('führt Kategorien ohne Budget nicht auf', () => {
    expect(budgetStatus(stateWith([tx({ id: '1' })]), '2026-03')).toHaveLength(0)
  })

  it('lässt Budgets auf Einnahme-Kategorien außen vor', () => {
    // Gezählt werden nur Ausgaben – ein Budget auf „Gehalt“ stünde sonst für
    // immer bei 0 % und sähe aus, als sei etwas kaputt.
    const state = stateWith([tx({ id: '1', kind: 'einnahme', cents: 250000, categoryId: 'cat-lohn' })], {
      categories: initialState().categories.map((c) =>
        c.id === 'cat-lohn' ? { ...c, budgetCents: 100000 } : c,
      ),
    })
    expect(budgetStatus(state, '2026-03')).toHaveLength(0)
  })
})

describe('Spartöpfe', () => {
  const pot: Pot = {
    id: 'p1',
    updatedAt: 1,
    deletedAt: null,
    name: 'Urlaub',
    emoji: '🏖️',
    targetCents: 100000,
    targetDate: null,
  }
  const entry = (cents: number, id: string): PotEntry => ({
    id,
    updatedAt: 1,
    deletedAt: null,
    potId: 'p1',
    cents,
    date: '2026-03-01',
    note: '',
    challengeId: null,
    slot: null,
  })

  it('rechnet Stand, Fortschritt und Rest', () => {
    const state = stateWith([], { pots: [pot], potEntries: [entry(25000, 'a'), entry(10000, 'b')] })
    const status = potStatus(state, pot)
    expect(status.savedCents).toBe(35000)
    expect(status.progress).toBe(35)
    expect(status.remainingCents).toBe(65000)
    expect(status.reached).toBe(false)
  })

  it('zieht Entnahmen ab', () => {
    const state = stateWith([], { pots: [pot], potEntries: [entry(25000, 'a'), entry(-5000, 'b')] })
    expect(potStatus(state, pot).savedCents).toBe(20000)
  })

  it('meldet ein erreichtes Ziel und deckelt bei 100 Prozent', () => {
    const state = stateWith([], { pots: [pot], potEntries: [entry(120000, 'a')] })
    const status = potStatus(state, pot)
    expect(status.reached).toBe(true)
    expect(status.progress).toBe(100)
    expect(status.remainingCents).toBe(0)
  })

  it('kommt ohne Zielbetrag zurecht', () => {
    const open: Pot = { ...pot, targetCents: null }
    const state = stateWith([], { pots: [open], potEntries: [entry(4200, 'a')] })
    const status = potStatus(state, open)
    expect(status.savedCents).toBe(4200)
    expect(status.remainingCents).toBeNull()
    expect(status.progress).toBe(0)
  })

  it('summiert über alle Töpfe', () => {
    const second: Pot = { ...pot, id: 'p2', name: 'Notgroschen' }
    const state = stateWith([], {
      pots: [pot, second],
      potEntries: [entry(1000, 'a'), { ...entry(2000, 'b'), potId: 'p2' }],
    })
    expect(totalSaved(state)).toBe(3000)
    expect(allPotStatus(state)).toHaveLength(2)
  })
})

describe('groupByDay', () => {
  it('gruppiert nach Tag, jüngster zuerst, mit Tagessaldo', () => {
    const groups = groupByDay([
      tx({ id: '1', cents: 1000, date: '2026-03-14' }),
      tx({ id: '2', cents: 2000, date: '2026-03-12' }),
      tx({ id: '3', cents: 500, date: '2026-03-14', kind: 'einnahme' }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]!.date).toBe('2026-03-14')
    expect(groups[0]!.txs).toHaveLength(2)
    expect(groups[0]!.netCents).toBe(-500) // 500 rein, 1000 raus
    expect(groups[1]!.date).toBe('2026-03-12')
  })
})

describe('frequentCategories', () => {
  it('stellt häufig benutzte Kategorien nach vorn', () => {
    const state = stateWith([
      tx({ id: '1', categoryId: 'cat-freizeit' }),
      tx({ id: '2', categoryId: 'cat-freizeit' }),
      tx({ id: '3', categoryId: 'cat-freizeit' }),
      tx({ id: '4', categoryId: 'cat-wohnen' }),
    ])
    expect(frequentCategories(state, 'ausgabe')[0]!.id).toBe('cat-freizeit')
  })

  it('liefert auch ohne Verlauf Kategorien und mischt die Arten nicht', () => {
    const ausgaben = frequentCategories(initialState(), 'ausgabe')
    expect(ausgaben.length).toBeGreaterThan(0)
    expect(ausgaben.every((c) => c.kind === 'ausgabe')).toBe(true)
  })
})

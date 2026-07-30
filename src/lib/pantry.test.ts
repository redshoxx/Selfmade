import { describe, expect, it } from 'vitest'
import {
  entries,
  expiryOf,
  filterEntries,
  isLow,
  needsAttention,
  pantryCounts,
  pantryHeadline,
  restockSuggestions,
  sortEntries,
} from './pantry'
import { initialState } from './store'
import type { PantryItem, ShopItem, State } from './types'

const HEUTE = '2026-03-14'

function item(over: Partial<PantryItem> & Pick<PantryItem, 'id' | 'name'>): PantryItem {
  return {
    updatedAt: 1,
    deletedAt: null,
    aisle: 'kuehl',
    qty: 2,
    unit: 'Stück',
    minQty: 0,
    bestBefore: null,
    ...over,
  }
}

function stateWith(items: PantryItem[], shopItems: ShopItem[] = []): State {
  return { ...initialState(), pantryItems: items, shopItems }
}

describe('expiryOf', () => {
  it('meldet ohne Datum nichts', () => {
    expect(expiryOf(item({ id: '1', name: 'Salz' }), HEUTE)).toEqual({ state: 'unbekannt', days: null })
  })

  it('erkennt abgelaufene Ware', () => {
    const result = expiryOf(item({ id: '1', name: 'Milch', bestBefore: '2026-03-12' }), HEUTE)
    expect(result.state).toBe('abgelaufen')
    expect(result.days).toBe(-2)
  })

  it('gibt Konserven mehr Vorlauf als Frischware', () => {
    // Beide laufen in drei Tagen ab, werden aber verschieden bewertet: Fleisch
    // kauft man für die nächsten Tage, drei Tage sind dort normal. Eine Dose
    // steht ein Jahr im Schrank – wenn die in drei Tagen abläuft, hat man sie
    // übersehen und muss sich jetzt kümmern.
    const fleisch = expiryOf(item({ id: '1', name: 'Hack', aisle: 'fleisch', bestBefore: '2026-03-17' }), HEUTE)
    const dose = expiryOf(item({ id: '2', name: 'Mais', aisle: 'konserven', bestBefore: '2026-03-17' }), HEUTE)
    expect(fleisch.state).toBe('frisch')
    expect(dose.state).toBe('dringend')
  })

  it('meldet dieselbe Frischware kurz vor Schluss doch noch', () => {
    // Fleisch, das morgen abläuft, muss sehr wohl auffallen.
    const morgen = expiryOf(item({ id: '1', name: 'Hack', aisle: 'fleisch', bestBefore: '2026-03-15' }), HEUTE)
    expect(morgen.state).toBe('dringend')
  })

  it('stuft entlang der Schwellen der Abteilung', () => {
    // Kühlregal: dringend ab 2 Tagen, bald ab 5 Tagen.
    const bei = (date: string) => expiryOf(item({ id: '1', name: 'Joghurt', aisle: 'kuehl', bestBefore: date }), HEUTE).state
    expect(bei('2026-03-14')).toBe('dringend') // heute
    expect(bei('2026-03-16')).toBe('dringend') // in 2 Tagen
    expect(bei('2026-03-17')).toBe('bald') // in 3 Tagen
    expect(bei('2026-03-19')).toBe('bald') // in 5 Tagen
    expect(bei('2026-03-20')).toBe('frisch') // in 6 Tagen
  })

  it('behandelt den heutigen Tag als dringend, nicht als abgelaufen', () => {
    // Was heute abläuft, ist heute noch gut – und muss heute weg.
    expect(expiryOf(item({ id: '1', name: 'Milch', bestBefore: HEUTE }), HEUTE).state).toBe('dringend')
  })
})

describe('needsAttention', () => {
  it('gilt für alles, was drängt', () => {
    expect(needsAttention('abgelaufen')).toBe(true)
    expect(needsAttention('dringend')).toBe(true)
    expect(needsAttention('bald')).toBe(true)
    expect(needsAttention('frisch')).toBe(false)
    expect(needsAttention('unbekannt')).toBe(false)
  })
})

describe('isLow', () => {
  it('schlägt bei erreichtem Mindestbestand an', () => {
    expect(isLow(item({ id: '1', name: 'Milch', qty: 1, minQty: 2 }))).toBe(true)
    expect(isLow(item({ id: '1', name: 'Milch', qty: 2, minQty: 2 }))).toBe(true)
    expect(isLow(item({ id: '1', name: 'Milch', qty: 3, minQty: 2 }))).toBe(false)
  })

  it('bleibt ohne Mindestbestand still', () => {
    // Nicht jeder will an Senf erinnert werden.
    expect(isLow(item({ id: '1', name: 'Senf', qty: 0, minQty: 0 }))).toBe(false)
  })
})

describe('sortEntries', () => {
  it('stellt Drängendes nach oben', () => {
    const state = stateWith([
      item({ id: '1', name: 'Salz' }),
      item({ id: '2', name: 'Joghurt', bestBefore: '2026-03-18' }),
      item({ id: '3', name: 'Milch', bestBefore: '2026-03-10' }),
      item({ id: '4', name: 'Käse', bestBefore: '2026-03-15' }),
    ])
    const sorted = sortEntries(entries(state, HEUTE))
    expect(sorted.map((e) => e.item.name)).toEqual(['Milch', 'Käse', 'Joghurt', 'Salz'])
  })

  it('sortiert Gleichrangiges stabil nach Namen', () => {
    const state = stateWith([item({ id: '1', name: 'Zucker' }), item({ id: '2', name: 'Mehl' })])
    expect(sortEntries(entries(state, HEUTE)).map((e) => e.item.name)).toEqual(['Mehl', 'Zucker'])
  })
})

describe('filterEntries', () => {
  const state = stateWith([
    item({ id: '1', name: 'Milch', bestBefore: '2026-03-10' }),
    item({ id: '2', name: 'Mehl', qty: 0, minQty: 1 }),
    item({ id: '3', name: 'Salz', qty: 5 }),
  ])
  const list = entries(state, HEUTE)

  it('filtert nach Ablauf, Nachkaufen und Leerstand', () => {
    expect(filterEntries(list, 'alle')).toHaveLength(3)
    expect(filterEntries(list, 'ablauf').map((e) => e.item.name)).toEqual(['Milch'])
    expect(filterEntries(list, 'nachkaufen').map((e) => e.item.name)).toEqual(['Mehl'])
    expect(filterEntries(list, 'leer').map((e) => e.item.name)).toEqual(['Mehl'])
  })
})

describe('pantryCounts', () => {
  it('zählt getrennt nach Dringlichkeit', () => {
    const state = stateWith([
      item({ id: '1', name: 'Milch', bestBefore: '2026-03-10' }), // abgelaufen
      item({ id: '2', name: 'Joghurt', bestBefore: '2026-03-15' }), // dringend
      item({ id: '3', name: 'Käse', bestBefore: '2026-03-18' }), // bald
      item({ id: '4', name: 'Mehl', qty: 0, minQty: 1, aisle: 'trocken' }),
    ])
    expect(pantryCounts(state, HEUTE)).toEqual({ urgent: 2, soon: 1, low: 1, total: 4 })
  })

  it('übergeht Gelöschtes', () => {
    const state = stateWith([item({ id: '1', name: 'Milch', bestBefore: '2026-03-10', deletedAt: 5 })])
    expect(pantryCounts(state, HEUTE).total).toBe(0)
  })
})

describe('restockSuggestions', () => {
  const shop = (over: Partial<ShopItem> & Pick<ShopItem, 'id' | 'name'>): ShopItem => ({
    updatedAt: 1,
    deletedAt: null,
    qty: '',
    aisle: 'kuehl',
    done: false,
    addedBy: 'Ich',
    pantryId: null,
    ...over,
  })

  it('schlägt vor, was zur Neige geht', () => {
    const state = stateWith([
      item({ id: 'p1', name: 'Milch', qty: 0, minQty: 1 }),
      item({ id: 'p2', name: 'Salz', qty: 5 }),
    ])
    expect(restockSuggestions(state, HEUTE).map((e) => e.item.name)).toEqual(['Milch'])
  })

  it('schlägt nichts vor, was schon auf der Liste steht', () => {
    // Weder über die Herkunft noch über den Namen – sonst nervt der Vorschlag
    // bei jedem Öffnen aufs Neue.
    const perHerkunft = stateWith(
      [item({ id: 'p1', name: 'Milch', qty: 0, minQty: 1 })],
      [shop({ id: 's1', name: 'Vollmilch', pantryId: 'p1' })],
    )
    expect(restockSuggestions(perHerkunft, HEUTE)).toHaveLength(0)

    const perName = stateWith(
      [item({ id: 'p1', name: 'Milch', qty: 0, minQty: 1 })],
      [shop({ id: 's1', name: 'milch' })],
    )
    expect(restockSuggestions(perName, HEUTE)).toHaveLength(0)
  })
})

describe('pantryHeadline', () => {
  it('nennt das Dringendste zuerst und beugt richtig', () => {
    expect(pantryHeadline({ urgent: 1, soon: 3, low: 2, total: 6 })).toBe('1 Produkt muss jetzt weg')
    expect(pantryHeadline({ urgent: 2, soon: 0, low: 0, total: 2 })).toBe('2 Produkte müssen jetzt weg')
    expect(pantryHeadline({ urgent: 0, soon: 1, low: 4, total: 5 })).toBe('1 Produkt läuft bald ab')
    expect(pantryHeadline({ urgent: 0, soon: 0, low: 2, total: 2 })).toBe('2 Produkte gehen zur Neige')
  })

  it('schweigt, wenn nichts zu tun ist', () => {
    expect(pantryHeadline({ urgent: 0, soon: 0, low: 0, total: 9 })).toBeNull()
  })
})

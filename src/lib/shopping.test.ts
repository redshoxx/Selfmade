import { describe, expect, it } from 'vitest'
import {
  aisleRank,
  findExisting,
  groupForShopping,
  neuGekauft,
  observedOrder,
  orderedAisles,
  shopCounts,
  suggestions,
  vorratsZugaenge,
} from './shopping'
import { initialState, reducer } from './store'
import type { AisleId, PantryItem, ShopItem, State } from './types'

function item(over: Partial<ShopItem> & Pick<ShopItem, 'id' | 'name'>): ShopItem {
  return {
    updatedAt: 1,
    deletedAt: null,
    qty: '',
    aisle: 'sonstiges',
    done: false,
    addedBy: 'Ich',
    pantryId: null,
    note: '',
    priceCents: null,
    ...over,
  }
}

function stateWith(items: ShopItem[], aisleOrder: Partial<Record<AisleId, number>> = {}): State {
  return { ...initialState(), shopItems: items, aisleOrder }
}

describe('aisleRank / orderedAisles', () => {
  it('nutzt ohne Erfahrung den üblichen Rundgang', () => {
    const state = stateWith([])
    // Obst und Gemüse liegt in aller Regel am Eingang, Drogerie hinten.
    expect(aisleRank(state, 'obst')).toBeLessThan(aisleRank(state, 'drogerie'))
    expect(orderedAisles(state)[0]!.id).toBe('obst')
  })

  it('lässt Gelerntes den Standard schlagen', () => {
    const state = stateWith([], { drogerie: 0, obst: 9 })
    expect(aisleRank(state, 'drogerie')).toBeLessThan(aisleRank(state, 'obst'))
    expect(orderedAisles(state)[0]!.id).toBe('drogerie')
  })
})

describe('groupForShopping', () => {
  it('gruppiert nach Abteilung in Laufrichtung', () => {
    const state = stateWith([
      item({ id: '1', name: 'Shampoo', aisle: 'drogerie' }),
      item({ id: '2', name: 'Apfel', aisle: 'obst' }),
      item({ id: '3', name: 'Milch', aisle: 'kuehl' }),
    ])
    const groups = groupForShopping(state)
    expect(groups.map((g) => g.aisle.id)).toEqual(['obst', 'kuehl', 'drogerie'])
  })

  it('lässt leere Abteilungen weg', () => {
    const groups = groupForShopping(stateWith([item({ id: '1', name: 'Milch', aisle: 'kuehl' })]))
    expect(groups).toHaveLength(1)
  })

  it('blendet Abgehaktes standardmäßig aus', () => {
    const state = stateWith([
      item({ id: '1', name: 'Milch', aisle: 'kuehl', done: true }),
      item({ id: '2', name: 'Brot', aisle: 'backwaren' }),
    ])
    expect(groupForShopping(state)).toHaveLength(1)
    expect(groupForShopping(state, { includeDone: true })).toHaveLength(2)
  })

  it('lässt gelöschte Einträge außen vor', () => {
    const state = stateWith([item({ id: '1', name: 'Milch', aisle: 'kuehl', deletedAt: 5 })])
    expect(groupForShopping(state)).toHaveLength(0)
  })

  it('schiebt Abgehaktes innerhalb der Abteilung nach unten', () => {
    const state = stateWith([
      item({ id: '1', name: 'Apfel', aisle: 'obst', done: true }),
      item({ id: '2', name: 'Zwiebel', aisle: 'obst' }),
    ])
    const items = groupForShopping(state, { includeDone: true })[0]!.items
    expect(items[0]!.name).toBe('Zwiebel')
    expect(items[1]!.name).toBe('Apfel')
  })

  it('zählt die offenen Einträge je Abteilung', () => {
    const state = stateWith([
      item({ id: '1', name: 'Apfel', aisle: 'obst' }),
      item({ id: '2', name: 'Banane', aisle: 'obst', done: true }),
    ])
    expect(groupForShopping(state, { includeDone: true })[0]!.openCount).toBe(1)
  })
})

describe('observedOrder', () => {
  it('liest die Laufrichtung aus den Häkchen', () => {
    const order = observedOrder([
      item({ id: '1', name: 'Wasser', aisle: 'getraenke', done: true, updatedAt: 300 }),
      item({ id: '2', name: 'Apfel', aisle: 'obst', done: true, updatedAt: 100 }),
      item({ id: '3', name: 'Milch', aisle: 'kuehl', done: true, updatedAt: 200 }),
    ])
    expect(order).toEqual(['obst', 'kuehl', 'getraenke'])
  })

  it('wertet je Abteilung das erste Häkchen', () => {
    // Wer zurückläuft, weil er die Butter vergessen hat, soll die gelernte
    // Reihenfolge nicht umwerfen.
    const order = observedOrder([
      item({ id: '1', name: 'Milch', aisle: 'kuehl', done: true, updatedAt: 100 }),
      item({ id: '2', name: 'Apfel', aisle: 'obst', done: true, updatedAt: 200 }),
      item({ id: '3', name: 'Butter', aisle: 'kuehl', done: true, updatedAt: 900 }),
    ])
    expect(order).toEqual(['kuehl', 'obst'])
  })

  it('übergeht Offenes und Gelöschtes', () => {
    const order = observedOrder([
      item({ id: '1', name: 'Milch', aisle: 'kuehl', done: false, updatedAt: 100 }),
      item({ id: '2', name: 'Apfel', aisle: 'obst', done: true, updatedAt: 200 }),
      item({ id: '3', name: 'Bier', aisle: 'getraenke', done: true, updatedAt: 50, deletedAt: 60 }),
    ])
    expect(order).toEqual(['obst'])
  })

  it('greift im Zusammenspiel mit dem Speicher', () => {
    // Ein voller Durchlauf: abhaken, Einkauf abschließen, Reihenfolge sitzt.
    let state = stateWith([
      item({ id: '1', name: 'Wasser', aisle: 'getraenke', done: true, updatedAt: 300 }),
      item({ id: '2', name: 'Apfel', aisle: 'obst', done: true, updatedAt: 100 }),
    ])
    state = reducer(state, { type: 'shop/finishTrip', order: observedOrder(state.shopItems), inDenVorrat: [] })
    expect(aisleRank(state, 'obst')).toBeLessThan(aisleRank(state, 'getraenke'))
  })
})

describe('shopCounts', () => {
  it('zählt offen und erledigt getrennt', () => {
    const state = stateWith([
      item({ id: '1', name: 'A' }),
      item({ id: '2', name: 'B', done: true }),
      item({ id: '3', name: 'C', deletedAt: 9 }),
    ])
    expect(shopCounts(state)).toEqual({ open: 1, done: 1, total: 2 })
  })
})

describe('findExisting', () => {
  it('erkennt Dubletten unabhängig von Schreibweise', () => {
    const state = stateWith([item({ id: '1', name: 'Milch' })])
    expect(findExisting(state, 'milch')?.id).toBe('1')
    expect(findExisting(state, '  MILCH ')?.id).toBe('1')
    expect(findExisting(state, 'Brot')).toBeNull()
    expect(findExisting(state, '  ')).toBeNull()
  })
})

describe('suggestions', () => {
  it('schlägt vor, was früher oft auf der Liste stand', () => {
    const state = stateWith([
      item({ id: '1', name: 'Milch', deletedAt: 10, updatedAt: 10 }),
      item({ id: '2', name: 'Milch', deletedAt: 20, updatedAt: 20 }),
      item({ id: '3', name: 'Brot', deletedAt: 15, updatedAt: 15 }),
    ])
    expect(suggestions(state, '')).toEqual(['Milch', 'Brot'])
  })

  it('filtert nach dem Getippten', () => {
    const state = stateWith([
      item({ id: '1', name: 'Milch', deletedAt: 10 }),
      item({ id: '2', name: 'Brot', deletedAt: 10 }),
    ])
    expect(suggestions(state, 'mil')).toEqual(['Milch'])
  })

  it('schlägt nichts vor, was schon auf der Liste steht', () => {
    const state = stateWith([
      item({ id: '1', name: 'Milch' }),
      item({ id: '2', name: 'Milch', deletedAt: 10 }),
    ])
    expect(suggestions(state, '')).toEqual([])
  })
})

describe('vorratsZugaenge', () => {
  const einkauf = (over: Partial<ShopItem> = {}): ShopItem => ({
    id: 'a',
    name: 'Milch',
    qty: '2',
    aisle: 'kuehl',
    done: true,
    addedBy: 'Ich',
    pantryId: null,
    note: '',
    priceCents: null,
    updatedAt: 1000,
    deletedAt: null,
    ...over,
  })

  const vorrat = (over: Partial<PantryItem> = {}): PantryItem => ({
    id: 'v1',
    name: 'Milch',
    aisle: 'kuehl',
    qty: 1,
    unit: 'l',
    minQty: 1,
    bestBefore: null,
    note: '',
    updatedAt: 1000,
    deletedAt: null,
    ...over,
  })

  it('zählt hoch, was aus einem Nachkaufen-Vorschlag kam', () => {
    const state = { shopItems: [einkauf({ pantryId: 'v1' })], pantryItems: [vorrat()] }
    const { hochzaehlen, neu } = vorratsZugaenge(state)

    expect(hochzaehlen).toEqual([{ pantryId: 'v1', menge: 2 }])
    expect(neu).toEqual([])
  })

  it('findet den Posten auch über den Namen', () => {
    // Wer „Milch“ von Hand aufschreibt, obwohl sie im Vorrat steht, soll
    // keinen zweiten Posten desselben Produkts bekommen.
    const state = { shopItems: [einkauf({ pantryId: null, name: 'milch ' })], pantryItems: [vorrat()] }
    const { hochzaehlen, neu } = vorratsZugaenge(state)

    expect(hochzaehlen).toEqual([{ pantryId: 'v1', menge: 2 }])
    expect(neu).toEqual([])
  })

  it('meldet Unbekanntes als neu, mit Menge und Einheit', () => {
    const state = { shopItems: [einkauf({ name: 'Mehl', qty: '500 g', aisle: 'trocken' })], pantryItems: [] }
    const { hochzaehlen, neu } = vorratsZugaenge(state)

    expect(hochzaehlen).toEqual([])
    expect(neu).toEqual([
      { shopId: 'a', name: 'Mehl', aisle: 'trocken', menge: 500, einheit: 'g' },
    ])
  })

  it('zählt eine undeutbare Menge als eins', () => {
    // „ein Karton Milch“ ist mehr als nichts. Null zu buchen wäre schlechter
    // als ungenau zu buchen.
    const state = { shopItems: [einkauf({ qty: 'ein Karton', pantryId: 'v1' })], pantryItems: [vorrat()] }
    expect(vorratsZugaenge(state).hochzaehlen).toEqual([{ pantryId: 'v1', menge: 1 }])
  })

  it('lässt Nicht-Abgehaktes in Ruhe', () => {
    const state = { shopItems: [einkauf({ done: false, pantryId: 'v1' })], pantryItems: [vorrat()] }
    const { hochzaehlen, neu } = vorratsZugaenge(state)
    expect(hochzaehlen).toEqual([])
    expect(neu).toEqual([])
  })
})

describe('neuGekauft', () => {
  const gekauft = (over: Partial<ShopItem> = {}): ShopItem => ({
    id: 'a',
    name: 'Mehl',
    qty: '500 g',
    aisle: 'trocken',
    done: true,
    addedBy: 'Ich',
    pantryId: null,
    note: '',
    priceCents: null,
    updatedAt: 1000,
    deletedAt: 1000,
    ...over,
  })

  it('bietet an, was gerade gekauft wurde und nicht im Vorrat steht', () => {
    const liste = neuGekauft({ shopItems: [gekauft()], pantryItems: [] }, 1000)
    expect(liste).toEqual([
      { shopId: 'a', name: 'Mehl', aisle: 'trocken', menge: 500, einheit: 'g' },
    ])
  })

  it('lässt weg, was schon im Vorrat liegt', () => {
    // So räumt sich der Streifen nach dem Übernehmen von selbst ab – ohne
    // dass irgendwo ein „erledigt“-Vermerk gespeichert werden müsste.
    const vorrat = {
      id: 'v1',
      name: 'Mehl',
      aisle: 'trocken' as const,
      qty: 1,
      unit: 'kg',
      minQty: 0,
      bestBefore: null,
      note: '',
      updatedAt: 1,
      deletedAt: null,
    }
    expect(neuGekauft({ shopItems: [gekauft()], pantryItems: [vorrat] }, 1000)).toEqual([])
  })

  it('vergisst Älteres von selbst', () => {
    const vorVierTagen = 1000 - 4 * 24 * 60 * 60 * 1000
    expect(neuGekauft({ shopItems: [gekauft({ deletedAt: vorVierTagen })], pantryItems: [] }, 1000)).toEqual([])
  })

  it('zeigt denselben Namen nur einmal', () => {
    const liste = neuGekauft(
      {
        shopItems: [gekauft({ id: 'alt', qty: '1 kg', deletedAt: 500 }), gekauft({ id: 'neu', deletedAt: 900 })],
        pantryItems: [],
      },
      1000,
    )
    expect(liste).toHaveLength(1)
    expect(liste[0]!.shopId).toBe('neu')
  })

  it('lässt Weggeworfenes aus, das nie gekauft wurde', () => {
    // Ein gelöschter, nie abgehakter Eintrag ist kein Einkauf.
    expect(neuGekauft({ shopItems: [gekauft({ done: false })], pantryItems: [] }, 1000)).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { hasChangesSince, initialState, live, loadState, mergeState, reducer, slotAmount, SYNC_LISTS } from './store'
import type { Challenge, PantryItem, Pot, ShopItem, State, Tx } from './types'

function withTx(state: State, over: Partial<Tx> = {}): State {
  return reducer(state, {
    type: 'tx/add',
    tx: {
      kind: 'ausgabe',
      cents: 1250,
      categoryId: 'cat-lebensmittel',
      note: '',
      date: '2026-03-14',
      recurring: false,
      ...over,
    },
  })
}

describe('Buchungen', () => {
  it('legt an, ändert und setzt einen Grabstein statt zu löschen', () => {
    let state = withTx(initialState())
    expect(live(state.txs)).toHaveLength(1)
    const id = state.txs[0]!.id

    state = reducer(state, { type: 'tx/update', id, patch: { cents: 999 } })
    expect(state.txs[0]!.cents).toBe(999)

    state = reducer(state, { type: 'tx/remove', id })
    // Der Eintrag bleibt in der Liste, sonst käme er beim nächsten Abgleich
    // von einem anderen Gerät zurück.
    expect(state.txs).toHaveLength(1)
    expect(live(state.txs)).toHaveLength(0)
  })

  it('frischt updatedAt bei jeder Änderung auf', () => {
    let state = withTx(initialState())
    const before = state.txs[0]!.updatedAt
    const id = state.txs[0]!.id
    state = reducer(state, { type: 'tx/update', id, patch: { note: 'Rewe' } })
    expect(state.txs[0]!.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('lässt eine unbekannte Kennung den Zustand unberührt', () => {
    const state = withTx(initialState())
    expect(reducer(state, { type: 'tx/update', id: 'gibtsnicht', patch: { cents: 1 } })).toBe(state)
  })
})

describe('Kategorien', () => {
  it('legt an und benennt um', () => {
    let state = reducer(initialState(), {
      type: 'category/add',
      category: { name: 'Haustier', emoji: '🐈', kind: 'ausgabe', budgetCents: 5000 },
    })
    const added = state.categories[state.categories.length - 1]!
    expect(added.name).toBe('Haustier')
    expect(added.budgetCents).toBe(5000)

    state = reducer(state, { type: 'category/update', id: added.id, patch: { name: 'Katze' } })
    expect(state.categories.find((c) => c.id === added.id)!.name).toBe('Katze')
  })

  it('lässt Buchungen beim Löschen unangetastet', () => {
    // Wer eine Kategorie aufräumt, erwartet nicht, dass seine Buchungen
    // mitverschwinden.
    let state = withTx(initialState(), { categoryId: 'cat-freizeit' })
    state = reducer(state, { type: 'category/remove', id: 'cat-freizeit' })
    expect(state.categories.some((c) => c.id === 'cat-freizeit')).toBe(false)
    expect(live(state.txs)).toHaveLength(1)
    expect(state.txs[0]!.categoryId).toBe('cat-freizeit')
  })

  it('behält die letzte Kategorie ihrer Art', () => {
    // Ohne sie ließe sich keine Ausgabe mehr erfassen – das Formular hätte
    // nichts auszuwählen.
    let state = initialState()
    const ausgaben = state.categories.filter((c) => c.kind === 'ausgabe')
    for (const category of ausgaben) {
      state = reducer(state, { type: 'category/remove', id: category.id })
    }
    expect(state.categories.filter((c) => c.kind === 'ausgabe')).toHaveLength(1)
    expect(state.categories.filter((c) => c.kind === 'einnahme').length).toBeGreaterThan(0)
  })

  it('lässt eine unbekannte Kennung den Zustand unberührt', () => {
    const state = initialState()
    expect(reducer(state, { type: 'category/remove', id: 'gibtsnicht' })).toBe(state)
  })
})

describe('Spartöpfe', () => {
  it('nimmt beim Löschen die Einzahlungen mit und löst Challenges', () => {
    let state = reducer(initialState(), {
      type: 'pot/add',
      pot: { name: 'Urlaub', emoji: '🏖️', targetCents: 100000, targetDate: null },
    })
    const potId = state.pots[0]!.id

    state = reducer(state, {
      type: 'potEntry/add',
      entry: { potId, cents: 5000, date: '2026-03-14', note: '', challengeId: null, slot: null },
    })
    state = reducer(state, {
      type: 'challenge/add',
      challenge: {
        name: '1-€-Challenge',
        kind: 'steigend',
        stepCents: 100,
        slots: 52,
        unit: 'woche',
        startDate: '2026-01-01',
        potId,
        filled: [],
        archived: false,
      },
    })

    state = reducer(state, { type: 'pot/remove', id: potId })
    expect(live(state.pots)).toHaveLength(0)
    // Sonst zählte die Sparsumme Beträge mit, zu denen es kein Ziel mehr gibt.
    expect(live(state.potEntries)).toHaveLength(0)
    // Die Challenge bleibt, nur ohne Topf.
    expect(live(state.challenges)).toHaveLength(1)
    expect(state.challenges[0]!.potId).toBeNull()
  })
})

describe('Challenge-Felder', () => {
  function withChallenge(over: Partial<Challenge> = {}) {
    let state = reducer(initialState(), {
      type: 'pot/add',
      pot: { name: 'Ziel', emoji: '🎯', targetCents: null, targetDate: null },
    })
    const potId = state.pots[0]!.id
    state = reducer(state, {
      type: 'challenge/add',
      challenge: {
        name: '1-€-Challenge',
        kind: 'steigend',
        stepCents: 100,
        slots: 52,
        unit: 'woche',
        startDate: '2026-01-01',
        potId,
        filled: [],
        archived: false,
        ...over,
      },
    })
    return { state, potId, id: state.challenges[0]!.id }
  }

  it('bucht beim Abhaken echtes Geld in den Topf', () => {
    const { state: start, id, potId } = withChallenge()
    // Feld 4 (0-basiert) der steigenden 1-€-Challenge ist die 5. Woche: 5 €.
    const state = reducer(start, { type: 'challenge/toggleSlot', id, slot: 4 })
    expect(state.challenges[0]!.filled).toEqual([4])
    const entries = live(state.potEntries)
    expect(entries).toHaveLength(1)
    expect(entries[0]!.cents).toBe(500)
    expect(entries[0]!.potId).toBe(potId)
    expect(entries[0]!.slot).toBe(4)
  })

  it('nimmt beim erneuten Tippen die Einzahlung zurück', () => {
    const { state: start, id } = withChallenge()
    let state = reducer(start, { type: 'challenge/toggleSlot', id, slot: 4 })
    state = reducer(state, { type: 'challenge/toggleSlot', id, slot: 4 })
    expect(state.challenges[0]!.filled).toEqual([])
    // Der Sparstand darf keinen Betrag behalten, den es nicht mehr gibt.
    expect(live(state.potEntries)).toHaveLength(0)
  })

  it('hält die Felder sortiert und ohne Dubletten', () => {
    const { state: start, id } = withChallenge()
    let state = reducer(start, { type: 'challenge/toggleSlot', id, slot: 9 })
    state = reducer(state, { type: 'challenge/toggleSlot', id, slot: 2 })
    state = reducer(state, { type: 'challenge/toggleSlot', id, slot: 5 })
    expect(state.challenges[0]!.filled).toEqual([2, 5, 9])
  })

  it('weist Felder außerhalb des Bereichs ab', () => {
    const { state: start, id } = withChallenge({ slots: 10 })
    expect(reducer(start, { type: 'challenge/toggleSlot', id, slot: 10 })).toBe(start)
    expect(reducer(start, { type: 'challenge/toggleSlot', id, slot: -1 })).toBe(start)
  })

  it('funktioniert auch ohne Spartopf', () => {
    const { state: start, id } = withChallenge({ potId: null })
    const state = reducer({ ...start, challenges: start.challenges.map((c) => ({ ...c, potId: null })) }, {
      type: 'challenge/toggleSlot',
      id,
      slot: 0,
    })
    expect(state.challenges[0]!.filled).toEqual([0])
    expect(live(state.potEntries)).toHaveLength(0)
  })
})

describe('challenge/start', () => {
  it('verknüpft Challenge und Spartopf sofort miteinander', () => {
    // Ohne die Verknüpfung bliebe jedes Häkchen folgenlos – das ist der ganze
    // Zweck dieser Aktion.
    const state = reducer(initialState(), {
      type: 'challenge/start',
      pot: { name: '1-€-Challenge', emoji: '1️⃣', targetCents: 137800, targetDate: null },
      challenge: {
        name: '1-€-Challenge',
        kind: 'steigend',
        stepCents: 100,
        slots: 52,
        unit: 'woche',
        startDate: '2026-01-05',
        filled: [],
        archived: false,
      },
    })

    expect(live(state.pots)).toHaveLength(1)
    expect(live(state.challenges)).toHaveLength(1)
    expect(state.challenges[0]!.potId).toBe(state.pots[0]!.id)
  })

  it('bewegt danach beim Abhaken echtes Geld', () => {
    let state = reducer(initialState(), {
      type: 'challenge/start',
      pot: { name: 'Test', emoji: '🎯', targetCents: null, targetDate: null },
      challenge: {
        name: 'Test',
        kind: 'steigend',
        stepCents: 100,
        slots: 52,
        unit: 'woche',
        startDate: '2026-01-05',
        filled: [],
        archived: false,
      },
    })
    state = reducer(state, { type: 'challenge/toggleSlot', id: state.challenges[0]!.id, slot: 4 })
    expect(live(state.potEntries)).toHaveLength(1)
    expect(live(state.potEntries)[0]!.cents).toBe(500)
  })

  it('kommt auch ohne Topf zurecht', () => {
    const state = reducer(initialState(), {
      type: 'challenge/start',
      pot: null,
      challenge: {
        name: 'Ohne Topf',
        kind: 'gleich',
        stepCents: 500,
        slots: 10,
        unit: 'woche',
        startDate: '2026-01-05',
        filled: [],
        archived: false,
      },
    })
    expect(live(state.pots)).toHaveLength(0)
    expect(state.challenges[0]!.potId).toBeNull()
  })
})

describe('slotAmount', () => {
  it('steigert bei der klassischen Challenge Woche für Woche', () => {
    const c = { kind: 'steigend' as const, stepCents: 100 }
    expect(slotAmount(c, 0)).toBe(100) // Woche 1: 1 €
    expect(slotAmount(c, 51)).toBe(5200) // Woche 52: 52 €
  })

  it('hält den Betrag bei gleichbleibender Challenge fest', () => {
    expect(slotAmount({ kind: 'gleich', stepCents: 500 }, 0)).toBe(500)
    expect(slotAmount({ kind: 'gleich', stepCents: 500 }, 30)).toBe(500)
  })
})

describe('Einkauf', () => {
  function withItem(state: State, name: string): State {
    return reducer(state, {
      type: 'shop/add',
      item: { name, qty: '', aisle: 'kuehl', done: false, addedBy: 'Ich', pantryId: null, note: '', priceCents: null },
    })
  }

  it('hakt ab und räumt Erledigtes weg', () => {
    let state = withItem(withItem(initialState(), 'Milch'), 'Brot')
    const id = state.shopItems[0]!.id
    state = reducer(state, { type: 'shop/toggle', id })
    expect(state.shopItems.find((i) => i.id === id)!.done).toBe(true)

    state = reducer(state, { type: 'shop/clearDone' })
    expect(live(state.shopItems)).toHaveLength(1)
  })

  it('lernt aus dem Einkauf die Reihenfolge der Abteilungen', () => {
    let state = withItem(initialState(), 'Milch')
    state = reducer(state, { type: 'shop/finishTrip', order: ['getraenke', 'obst', 'kuehl'] })
    const order = state.aisleOrder
    // Beim ersten Einkauf wird die beobachtete Folge direkt übernommen.
    expect(order.getraenke).toBe(0)
    expect(order.obst).toBe(1)
    expect(order.kuehl).toBe(2)
  })

  it('lässt einen einzelnen Einkauf die gelernte Reihenfolge nicht umwerfen', () => {
    let state = initialState()
    state = reducer(state, { type: 'shop/finishTrip', order: ['obst', 'kuehl'] })
    // Ein einzelner abweichender Einkauf soll die Sortierung nur anschubsen.
    state = reducer(state, { type: 'shop/finishTrip', order: ['kuehl', 'obst'] })
    expect(state.aisleOrder.obst!).toBeGreaterThan(0)
    expect(state.aisleOrder.obst!).toBeLessThan(1)
    expect(state.aisleOrder.obst!).toBeLessThan(state.aisleOrder.kuehl!)
  })
})

describe('mergeState', () => {
  const base = (over: Partial<ShopItem>): ShopItem => ({
    id: 'a',
    updatedAt: 1000,
    deletedAt: null,
    name: 'Milch',
    qty: '',
    aisle: 'kuehl',
    done: false,
    addedBy: 'Ich',
    pantryId: null,
    note: '',
    priceCents: null,
    ...over,
  })

  it('lässt den jüngeren Stand gewinnen', () => {
    const mine: State = { ...initialState(), shopItems: [base({ updatedAt: 1000, done: false })] }
    const merged = mergeState(mine, { shopItems: [base({ updatedAt: 2000, done: true })] })
    expect(merged.shopItems[0]!.done).toBe(true)
  })

  it('behält den eigenen Stand, wenn er jünger ist', () => {
    const mine: State = { ...initialState(), shopItems: [base({ updatedAt: 3000, done: true })] }
    const merged = mergeState(mine, { shopItems: [base({ updatedAt: 2000, done: false })] })
    expect(merged.shopItems[0]!.done).toBe(true)
  })

  it('übernimmt fremde Einträge und behält die eigenen', () => {
    const mine: State = { ...initialState(), shopItems: [base({ id: 'a' })] }
    const merged = mergeState(mine, { shopItems: [base({ id: 'b', name: 'Brot' })] })
    expect(merged.shopItems).toHaveLength(2)
  })

  it('trägt Löschungen der anderen Seite mit', () => {
    const mine: State = { ...initialState(), shopItems: [base({ updatedAt: 1000 })] }
    const merged = mergeState(mine, { shopItems: [base({ updatedAt: 2000, deletedAt: 2000 })] })
    expect(live(merged.shopItems)).toHaveLength(0)
  })
})

describe('loadState', () => {
  it('gibt bei fehlendem oder kaputtem Speicher den Startzustand', () => {
    expect(loadState(null).txs).toEqual([])
    expect(loadState('kein json').txs).toEqual([])
    expect(loadState('null').categories.length).toBeGreaterThan(0)
    expect(loadState('[]').txs).toEqual([])
  })

  it('wirft unbrauchbare Einträge raus und behält den Rest', () => {
    const raw = JSON.stringify({
      txs: [
        { id: 'gut', updatedAt: 1, deletedAt: null, kind: 'ausgabe', cents: 500, categoryId: 'c', note: '', date: '2026-03-14', recurring: false },
        { id: 'ohne-betrag', updatedAt: 1, deletedAt: null, kind: 'ausgabe', cents: 'viel', date: '2026-03-14' },
        { id: 'ohne-art', updatedAt: 1, deletedAt: null, kind: 'quatsch', cents: 100, date: '2026-03-14' },
        { kind: 'ausgabe', cents: 100, date: '2026-03-14' }, // ohne Kennung
        null,
      ],
    })
    const state = loadState(raw)
    expect(state.txs).toHaveLength(1)
    expect(state.txs[0]!.id).toBe('gut')
  })

  it('lässt doppelte Kennungen nicht durch', () => {
    const tx = { updatedAt: 1, deletedAt: null, kind: 'ausgabe', cents: 500, categoryId: 'c', note: '', date: '2026-03-14', recurring: false }
    const state = loadState(JSON.stringify({ txs: [{ ...tx, id: 'x' }, { ...tx, id: 'x' }] }))
    expect(state.txs).toHaveLength(1)
  })

  it('säubert Challenge-Felder', () => {
    const raw = JSON.stringify({
      challenges: [
        {
          id: 'c1',
          updatedAt: 1,
          deletedAt: null,
          name: 'Test',
          kind: 'steigend',
          stepCents: 100,
          slots: 10,
          unit: 'woche',
          startDate: '2026-01-01',
          potId: null,
          // Dubletten, außerhalb des Bereichs, unsortiert und kein Zahlenwert.
          filled: [3, 3, 99, -1, 'x', 1],
          archived: false,
        },
      ],
    })
    expect(loadState(raw).challenges[0]!.filled).toEqual([1, 3])
  })

  it('behält Einträge aus einer früheren Fassung der App', () => {
    // So sah ein gespeicherter Einkaufszettel aus, bevor es Notizen und Preise
    // gab. Solche Einträge dürfen nicht verschwinden – sie sind in Ordnung,
    // nur älter. Die fehlenden Felder werden ergänzt.
    const alt = JSON.stringify({
      shopItems: [
        { id: 'alt1', updatedAt: 1, deletedAt: null, name: 'Milch', qty: '2', aisle: 'kuehl', done: false, addedBy: 'Ich', pantryId: null },
      ],
      pantryItems: [
        { id: 'alt2', updatedAt: 1, deletedAt: null, name: 'Mehl', aisle: 'trocken', qty: 1, unit: 'kg', minQty: 0, bestBefore: null },
      ],
    })
    const state = loadState(alt)

    expect(state.shopItems).toHaveLength(1)
    expect(state.shopItems[0]!.name).toBe('Milch')
    expect(state.shopItems[0]!.qty).toBe('2')
    expect(state.shopItems[0]!.note).toBe('')
    expect(state.shopItems[0]!.priceCents).toBeNull()

    expect(state.pantryItems).toHaveLength(1)
    expect(state.pantryItems[0]!.note).toBe('')

    // Die neuen Listen fehlen in alten Ständen – dann eben leer, nicht kaputt.
    expect(state.notes).toEqual([])
    expect(state.shopTemplates).toEqual([])
    expect(state.recurringTxs).toEqual([])
  })

  it('fällt bei leerer Kategorienliste auf die Startkategorien zurück', () => {
    // Ohne Kategorien ließe sich keine Buchung erfassen.
    expect(loadState(JSON.stringify({ categories: [] })).categories.length).toBeGreaterThan(0)
  })

  it('nimmt gültige Einstellungen und ersetzt ungültige', () => {
    const state = loadState(JSON.stringify({ settings: { displayName: 'Lea', theme: 'dunkel', startTab: 'quatsch', haptics: 'ja' } }))
    expect(state.settings.displayName).toBe('Lea')
    expect(state.settings.theme).toBe('dunkel')
    expect(state.settings.startTab).toBe('start')
    expect(state.settings.haptics).toBe(true)
  })

  it('liest Vorrat und Haushalt zurück', () => {
    const item: PantryItem = {
      id: 'p1',
      updatedAt: 5,
      deletedAt: null,
      name: 'Milch',
      aisle: 'kuehl',
      qty: 2,
      unit: 'l',
      minQty: 1,
      bestBefore: '2026-03-20',
      note: '',
    }
    const pot: Pot = { id: 'pot1', updatedAt: 5, deletedAt: null, name: 'Urlaub', emoji: '🏖️', targetCents: 50000, targetDate: null }
    const state = loadState(
      JSON.stringify({
        pantryItems: [item],
        pots: [pot],
        household: { id: 'h1', name: 'Zuhause', inviteCode: 'K7M-2QD', members: [{ userId: 'u1', name: 'Lea' }] },
      }),
    )
    expect(state.pantryItems[0]!.name).toBe('Milch')
    expect(state.pots[0]!.targetCents).toBe(50000)
    expect(state.household!.members).toHaveLength(1)
  })
})

describe('hasChangesSince', () => {
  /**
   * Die Liste der abzugleichenden Listen stand einmal doppelt: einmal zum
   * Hochladen, einmal zum Erkennen, dass es etwas hochzuladen gibt. In der
   * zweiten fehlten drei – geteilte Notizen gingen deshalb nie von selbst
   * hoch, sondern nur, wenn zufällig gleichzeitig ein Einkaufseintrag
   * geändert wurde. Dieser Test hält beide Enden zusammen.
   */
  const NICHT_EINZELN = ['categories']

  it('lässt keine Liste des Zustands aus', () => {
    const listen = Object.entries(initialState())
      .filter(([, wert]) => Array.isArray(wert))
      .map(([schluessel]) => schluessel)

    for (const schluessel of listen) {
      expect([...SYNC_LISTS, ...NICHT_EINZELN]).toContain(schluessel)
    }
  })

  it('erkennt eine neue Notiz', () => {
    const state = reducer(initialState(), { type: 'note/add', note: { title: 'Rezept', body: '', pinned: false } })
    expect(hasChangesSince(state, 0)).toBe(true)
    expect(hasChangesSince(state, Date.now() + 1000)).toBe(false)
  })

  it('erkennt eine umbenannte Kategorie', () => {
    // Kategorien haben keinen eigenen Zeitstempel; ohne den Stand des Ganzen
    // bliebe eine Umbenennung für den Abgleich unsichtbar.
    const vorher = initialState()
    const state = reducer(vorher, {
      type: 'category/update',
      id: vorher.categories[0]!.id,
      patch: { name: 'Wocheneinkauf' },
    })
    expect(hasChangesSince(state, 0)).toBe(true)
  })

  it('meldet nichts, solange nichts passiert ist', () => {
    expect(hasChangesSince(initialState(), 0)).toBe(false)
  })
})

describe('mergeState mit Kategorien', () => {
  const mitKategorie = (name: string, prefsUpdatedAt: number): Partial<State> => ({
    categories: [{ id: 'c1', name, emoji: '•', kind: 'ausgabe', budgetCents: null }],
    prefsUpdatedAt,
  })

  it('übernimmt den jüngeren Stand vom Server', () => {
    const meiner: State = { ...initialState(), prefsUpdatedAt: 100 }
    const merged = mergeState(meiner, mitKategorie('Vom Server', 200))
    expect(merged.categories.map((c) => c.name)).toEqual(['Vom Server'])
    expect(merged.prefsUpdatedAt).toBe(200)
  })

  it('behält den eigenen, wenn er jünger ist', () => {
    // Sonst schlüge ein zweiter Abgleich die gerade umbenannte Kategorie mit
    // dem alten Namen vom Server zurück.
    const meiner: State = {
      ...initialState(),
      categories: [{ id: 'c1', name: 'Gerade umbenannt', emoji: '•', kind: 'ausgabe', budgetCents: null }],
      prefsUpdatedAt: 300,
    }
    const merged = mergeState(meiner, mitKategorie('Alt', 200))
    expect(merged.categories.map((c) => c.name)).toEqual(['Gerade umbenannt'])
    expect(merged.prefsUpdatedAt).toBe(300)
  })

  it('ersetzt vorhandene Kategorien nie durch eine leere Liste', () => {
    // Ohne Kategorien ließe sich nichts mehr erfassen.
    const meiner = initialState()
    const merged = mergeState(meiner, { categories: [], prefsUpdatedAt: Date.now() })
    expect(merged.categories.length).toBe(meiner.categories.length)
  })
})

import { describe, expect, it } from 'vitest'
import { pullAll } from './sync'

/**
 * Ein vorgetäuschter Client.
 *
 * Geprüft wird hier nur eines, dafür das Wichtigste: Verschluckt `pullAll`
 * einen Fehler, hält der Aufrufer den Abgleich für geglückt und die App meldet
 * „verbunden“, während nichts ankommt. Genau so verhält sie sich, wenn das
 * Schema noch nicht eingespielt ist – der häufigste Fall bei der Einrichtung.
 */
function fakeClient(antwort: (tabelle: string) => { data: unknown; error: unknown }) {
  return {
    from: (tabelle: string) => {
      const kette: Record<string, unknown> = {
        select: () => kette,
        eq: () => Promise.resolve(antwort(tabelle)),
      }
      return kette
    },
  } as never
}

const args = { userId: 'u1', householdId: 'h1' }

describe('pullAll', () => {
  it('liefert Daten und keine Fehler, wenn alles gut geht', async () => {
    const client = fakeClient(() => ({ data: [], error: null }))
    const { incoming, errors } = await pullAll(client, args)

    expect(errors).toEqual([])
    expect(incoming.shopItems).toEqual([])
    expect(incoming.pantryItems).toEqual([])
    expect(incoming.notes).toEqual([])
  })

  it('meldet eine fehlende Tabelle, statt sie zu verschlucken', async () => {
    const client = fakeClient((t) =>
      t === 'shop_items'
        ? { data: null, error: { code: '42P01', message: 'relation does not exist' } }
        : { data: [], error: null },
    )
    const { errors } = await pullAll(client, args)

    expect(errors).toHaveLength(1)
    expect(errors[0]!.table).toBe('shop_items')
    expect(errors[0]!.error.code).toBe('42P01')
  })

  it('sammelt mehrere Fehler ein', async () => {
    const client = fakeClient(() => ({ data: null, error: { code: '42P01', message: 'nope' } }))
    const { errors } = await pullAll(client, args)
    // Fünf private und fünf geteilte Abfragen.
    expect(errors.length).toBe(10)
  })

  it('behält die Datensätze, die trotz eines Fehlers ankamen', async () => {
    // Eine fehlende Tabelle darf nicht das Wenige wegwerfen, das gelesen wurde.
    const zeile = {
      id: 'a',
      name: 'Milch',
      qty: '2',
      aisle: 'kuehl',
      done: false,
      added_by: 'Ich',
      note: '',
      price_cents: null,
      updated_at: 5,
      deleted_at: null,
    }
    const client = fakeClient((t) => {
      if (t === 'shop_items') return { data: [zeile], error: null }
      if (t === 'notes') return { data: null, error: { code: '42P01', message: 'does not exist' } }
      return { data: [], error: null }
    })
    const { incoming, errors } = await pullAll(client, args)

    expect(incoming.shopItems).toHaveLength(1)
    expect(incoming.shopItems![0]!.name).toBe('Milch')
    expect(incoming.shopItems![0]!.qty).toBe('2')
    expect(errors.map((e) => e.table)).toEqual(['notes'])
  })

  it('fragt ohne Haushalt nur die privaten Tabellen ab', async () => {
    const gefragt: string[] = []
    const client = fakeClient((t) => {
      gefragt.push(t)
      return { data: [], error: null }
    })
    await pullAll(client, { userId: 'u1', householdId: null })

    expect(gefragt).toContain('txs')
    expect(gefragt).not.toContain('shop_items')
  })
})

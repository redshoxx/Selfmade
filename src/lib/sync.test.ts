import { describe, expect, it } from 'vitest'
import { loadHousehold, pullAll } from './sync'

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
      // Die Kette gibt sich selbst zurück und ist zugleich abwartbar. So ist
      // es gleichgültig, ob die Abfrage nach `.eq()` oder erst nach `.limit()`
      // endet – der Test schreibt der Anwendung nicht vor, wie sie fragt.
      const kette: Record<string, unknown> = {
        select: () => kette,
        eq: () => kette,
        limit: () => kette,
        maybeSingle: () => Promise.resolve(antwort(tabelle)),
        then: (
          erfuellt: (wert: { data: unknown; error: unknown }) => unknown,
          abgelehnt?: (grund: unknown) => unknown,
        ) => Promise.resolve(antwort(tabelle)).then(erfuellt, abgelehnt),
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
    // Sechs private und fünf geteilte Abfragen.
    expect(errors.length).toBe(11)
  })

  it('holt Kategorien und Einstellungen mit', async () => {
    // Ohne sie stünde auf einem zweiten Gerät bei jeder Buchung „Ohne
    // Kategorie“: Die Buchungen kämen an, ihre Kategorien nicht.
    const client = fakeClient((t) =>
      t === 'user_prefs'
        ? {
            data: [
              {
                categories: [
                  { id: 'c1', name: 'Miete', emoji: '🏠', kind: 'ausgabe', budget_cents: 90000 },
                ],
                settings: { display_name: 'Wolfgang', start_tab: 'einkauf' },
                updated_at: 42,
              },
            ],
            error: null,
          }
        : { data: [], error: null },
    )
    const { incoming, errors } = await pullAll(client, args)

    expect(errors).toEqual([])
    expect(incoming.categories).toEqual([
      { id: 'c1', name: 'Miete', emoji: '🏠', kind: 'ausgabe', budgetCents: 90000 },
    ])
    expect(incoming.settings?.displayName).toBe('Wolfgang')
    expect(incoming.settings?.startTab).toBe('einkauf')
    expect(incoming.prefsUpdatedAt).toBe(42)
  })

  it('lässt die Kategorien in Ruhe, wenn der Server keine hat', async () => {
    // Eine leere Liste vom Server dürfte die vorhandene nie ersetzen – sonst
    // ließe sich nach dem ersten Abgleich nichts mehr erfassen.
    const client = fakeClient((t) =>
      t === 'user_prefs'
        ? { data: [{ categories: [], settings: {}, updated_at: 7 }], error: null }
        : { data: [], error: null },
    )
    const { incoming } = await pullAll(client, args)

    expect(incoming.categories).toBeUndefined()
    expect(incoming.prefsUpdatedAt).toBe(7)
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

describe('loadHousehold', () => {
  it('unterscheidet „kein Haushalt“ von „konnte nicht nachsehen“', async () => {
    // Der Unterschied ist der Grund für den Rückgabetyp: Vorher galt jeder
    // Fehler als „gehört zu keinem Haushalt“. Ein Funkloch beim Start reichte
    // dann, und die App vergaß den Haushalt samt Teilen.
    const kaputt = fakeClient(() => ({ data: null, error: { message: 'Failed to fetch' } }))
    await expect(loadHousehold(kaputt, 'u1')).resolves.toEqual({
      status: 'fehler',
      error: { message: 'Failed to fetch' },
    })

    const leer = fakeClient(() => ({ data: [], error: null }))
    await expect(loadHousehold(leer, 'u1')).resolves.toEqual({ status: 'keiner' })
  })

  it('liest Haushalt und Mitglieder', async () => {
    const client = fakeClient((t) => {
      if (t === 'household_members') {
        return {
          data: [
            { household_id: 'h1', user_id: 'u1', name: 'Wolfgang' },
            { household_id: 'h1', user_id: 'u2', name: 'Freundin' },
          ],
          error: null,
        }
      }
      return { data: { id: 'h1', name: 'Zuhause', invite_code: 'K7M-2QD' }, error: null }
    })

    const ergebnis = await loadHousehold(client, 'u1')
    expect(ergebnis.status).toBe('ok')
    if (ergebnis.status !== 'ok') return
    expect(ergebnis.household.inviteCode).toBe('K7M-2QD')
    expect(ergebnis.household.members.map((m) => m.name)).toEqual(['Wolfgang', 'Freundin'])
  })

  it('meldet „keiner“, wenn der Haushalt zur Mitgliedschaft fehlt', async () => {
    // Aufgelöster Haushalt: Die Mitgliedschaft zeigt ins Leere. Das ist keine
    // Störung, sondern eine klare Antwort – die App soll den Beitritt anbieten.
    const client = fakeClient((t) =>
      t === 'household_members'
        ? { data: [{ household_id: 'h1' }], error: null }
        : { data: null, error: null },
    )
    await expect(loadHousehold(client, 'u1')).resolves.toEqual({ status: 'keiner' })
  })
})

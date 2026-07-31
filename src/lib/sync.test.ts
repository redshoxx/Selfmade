import { describe, expect, it } from 'vitest'
import { ladeErlaubte, pruefeZugang, pullAll } from './sync'

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
        order: () => kette,
        then: (
          erfuellt: (wert: { data: unknown; error: unknown }) => unknown,
          abgelehnt?: (grund: unknown) => unknown,
        ) => Promise.resolve(antwort(tabelle)).then(erfuellt, abgelehnt),
      }
      return kette
    },
    rpc: (name: string) => Promise.resolve(antwort(`rpc:${name}`)),
  } as never
}

const args = { userId: 'u1' }

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

  it('fragt die geteilten Tabellen ohne Bedingung ab', async () => {
    // Früher hing das an einem Haushalt: Wer keinen hatte, bekam die geteilten
    // Tabellen gar nicht erst zu sehen – und merkte nicht, dass seine Liste
    // nur auf dem Gerät lag. Jetzt wird immer gefragt; wer etwas sehen darf,
    // entscheiden die Zugriffsregeln in der Datenbank.
    const gefragt: string[] = []
    const client = fakeClient((t) => {
      gefragt.push(t)
      return { data: [], error: null }
    })
    await pullAll(client, { userId: 'u1' })

    expect(gefragt).toContain('txs')
    expect(gefragt).toContain('shop_items')
    expect(gefragt).toContain('pantry_items')
    expect(gefragt).toContain('notes')
  })
})

describe('Zugangsliste', () => {
  it('liest, wer mitlesen darf', async () => {
    const client = fakeClient(() => ({
      data: [
        { email: 'wolfgang@example.com', name: 'Wolfgang' },
        { email: 'freundin@example.com', name: 'Freundin' },
      ],
      error: null,
    }))

    await expect(ladeErlaubte(client)).resolves.toEqual([
      { email: 'wolfgang@example.com', name: 'Wolfgang' },
      { email: 'freundin@example.com', name: 'Freundin' },
    ])
  })

  it('sagt bei fehlenden Tabellen, was zu tun ist', async () => {
    // „Das hat nicht geklappt“ schickt in die falsche Richtung, wenn nur das
    // Schema fehlt.
    const client = fakeClient(() => ({
      data: null,
      error: { code: 'PGRST205', message: 'Could not find the table' },
    }))

    await expect(ladeErlaubte(client)).rejects.toThrow(/schema\.sql/)
  })

  it('beantwortet die Freischaltung als klares Ja oder Nein', async () => {
    // Ein `null` vom Server darf nie als „darf mitlesen“ durchgehen.
    await expect(pruefeZugang(fakeClient(() => ({ data: true, error: null })))).resolves.toBe(true)
    await expect(pruefeZugang(fakeClient(() => ({ data: false, error: null })))).resolves.toBe(false)
    await expect(pruefeZugang(fakeClient(() => ({ data: null, error: null })))).resolves.toBe(false)
  })
})

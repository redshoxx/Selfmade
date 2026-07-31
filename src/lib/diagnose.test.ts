import { describe, expect, it } from 'vitest'
import {
  erklaereFehler,
  istNetzfehler,
  istTabelleFehlt,
  istZugriffVerweigert,
  pruefeVerbindung,
} from './diagnose'

/**
 * Ein vorgetäuschter Supabase-Client.
 *
 * Das echte Projekt ist aus der Prüfumgebung nicht erreichbar, und gerade die
 * Fehlerfälle – fehlendes Schema, greifende Zugriffsregeln – lassen sich dort
 * ohnehin schlecht herstellen. Hier werden sie gezielt gestellt.
 */
function fakeClient(antwort: (tabelle: string) => { data: unknown; error: unknown; count?: number }) {
  const bauer = (tabelle: string) => {
    const ergebnis = () => antwort(tabelle)
    const kette: Record<string, unknown> = {
      select: () => kette,
      eq: () => kette,
      limit: () => Promise.resolve(ergebnis()),
      then: (resolve: (v: unknown) => void) => resolve(ergebnis()),
    }
    return kette
  }
  return { from: (tabelle: string) => bauer(tabelle) } as never
}

describe('Fehler deuten', () => {
  it('erkennt eine fehlende Tabelle', () => {
    expect(istTabelleFehlt({ code: '42P01' })).toBe(true)
    expect(istTabelleFehlt({ code: 'PGRST205' })).toBe(true)
    expect(istTabelleFehlt({ message: 'relation "public.shop_items" does not exist' })).toBe(true)
    expect(istTabelleFehlt({ message: "Could not find the table 'public.notes'" })).toBe(true)
    expect(istTabelleFehlt({ code: '42501' })).toBe(false)
    expect(istTabelleFehlt(null)).toBe(false)
  })

  it('erkennt verweigerten Zugriff', () => {
    expect(istZugriffVerweigert({ code: '42501' })).toBe(true)
    expect(istZugriffVerweigert({ message: 'permission denied for table txs' })).toBe(true)
    expect(istZugriffVerweigert({ message: 'new row violates row-level security policy' })).toBe(true)
    expect(istZugriffVerweigert({ code: '42P01' })).toBe(false)
  })

  it('erkennt einen Netzfehler', () => {
    expect(istNetzfehler({ message: 'TypeError: Failed to fetch' })).toBe(true)
    expect(istNetzfehler({ message: 'NetworkError when attempting to fetch resource' })).toBe(true)
    expect(istNetzfehler({ message: 'Load failed' })).toBe(true)
    expect(istNetzfehler({ code: '42P01' })).toBe(false)
  })

  it('nennt zu jedem Fall den nächsten Schritt', () => {
    // Der Unterschied, auf den es ankommt: „kein Kontakt“ schickt in die
    // falsche Richtung, wenn der Kontakt steht und bloß Tabellen fehlen.
    expect(erklaereFehler({ code: '42P01' })).toContain('schema.sql')
    expect(erklaereFehler({ code: '42501' })).toContain('schema.sql')
    expect(erklaereFehler({ message: 'Failed to fetch' })).toContain('Keine Verbindung')
    expect(erklaereFehler({ code: '42P01' })).not.toContain('Keine Verbindung')
  })
})

describe('pruefeVerbindung', () => {
  const zustand = (checks: Awaited<ReturnType<typeof pruefeVerbindung>>, label: string) =>
    checks.find((c) => c.label === label)

  it('meldet fehlende Zugangsdaten und prüft nicht weiter', async () => {
    const checks = await pruefeVerbindung({
      client: null,
      configured: false,
      userId: null,
      householdId: null,
    })
    expect(zustand(checks, 'Zugangsdaten')?.state).toBe('fehler')
    expect(zustand(checks, 'Server erreichbar')?.state).toBe('uebersprungen')
  })

  it('meldet einen Netzfehler und bricht danach ab', async () => {
    const client = fakeClient(() => ({ data: null, error: { message: 'Failed to fetch' } }))
    const checks = await pruefeVerbindung({ client, configured: true, userId: 'u1', householdId: null })

    expect(zustand(checks, 'Server erreichbar')?.state).toBe('fehler')
    expect(zustand(checks, 'Tabellen')?.state).toBe('uebersprungen')
  })

  it('erkennt ein nicht eingespieltes Schema', async () => {
    // Der Server antwortet, aber es gibt keine Tabellen – der häufigste Fall.
    const client = fakeClient(() => ({
      data: null,
      error: { code: '42P01', message: 'relation does not exist' },
    }))
    const checks = await pruefeVerbindung({ client, configured: true, userId: 'u1', householdId: null })

    expect(zustand(checks, 'Server erreichbar')?.state).toBe('ok')
    const tabellen = zustand(checks, 'Tabellen')
    expect(tabellen?.state).toBe('fehler')
    expect(tabellen?.detail).toContain('schema.sql')
  })

  it('unterscheidet später ergänzte Tabellen von den unverzichtbaren', async () => {
    // Wer ein älteres Schema eingespielt hat, dem fehlen nur die neuen
    // Tabellen. Das ist eine Warnung, kein Totalausfall.
    const client = fakeClient((t) =>
      ['notes', 'shop_templates', 'recurring_txs'].includes(t)
        ? { data: null, error: { code: '42P01', message: 'does not exist' } }
        : { data: [], error: null },
    )
    const checks = await pruefeVerbindung({ client, configured: true, userId: 'u1', householdId: null })

    const tabellen = zustand(checks, 'Tabellen')
    expect(tabellen?.state).toBe('warnung')
    expect(tabellen?.detail).toContain('notes')
  })

  it('meldet fehlenden Haushalt als Warnung, nicht als Fehler', async () => {
    const client = fakeClient(() => ({ data: [], error: null }))
    const checks = await pruefeVerbindung({ client, configured: true, userId: 'u1', householdId: null })

    expect(zustand(checks, 'Tabellen')?.state).toBe('ok')
    expect(zustand(checks, 'Haushalt')?.state).toBe('warnung')
  })

  it('meldet fehlende Anmeldung', async () => {
    const client = fakeClient(() => ({ data: [], error: null }))
    const checks = await pruefeVerbindung({ client, configured: true, userId: null, householdId: null })

    expect(zustand(checks, 'Angemeldet')?.state).toBe('fehler')
    // Der Hinweis nennt die Handlung, nicht den Zustand.
    expect(zustand(checks, 'Angemeldet')?.detail).toContain('E-Mail')
  })

  it('zählt bei bestehendem Haushalt die Einträge auf dem Server', async () => {
    const client = fakeClient((t) => ({
      data: [],
      error: null,
      count: t === 'shop_items' ? 7 : t === 'pantry_items' ? 3 : 0,
    }))
    const checks = await pruefeVerbindung({ client, configured: true, userId: 'u1', householdId: 'h1' })

    const daten = zustand(checks, 'Geteilte Daten')
    expect(daten?.state).toBe('ok')
    expect(daten?.detail).toContain('7')
    expect(daten?.detail).toContain('3')
  })

  it('geht die Liste vollständig durch, statt beim ersten Fehler zu stoppen', async () => {
    // Wer sieht, wie weit es trägt, löst nicht einen Punkt nach dem anderen
    // und startet jedes Mal neu.
    const client = fakeClient(() => ({ data: [], error: null }))
    const checks = await pruefeVerbindung({ client, configured: true, userId: null, householdId: null })
    expect(checks.length).toBeGreaterThanOrEqual(4)
  })
})

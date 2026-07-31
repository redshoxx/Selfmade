import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Was ist mit der Verbindung los?
 *
 * Der Abgleich läuft im Hintergrund, und wenn er nicht läuft, sieht man dem
 * Bildschirm das nicht an. Diese Datei beantwortet die Frage, die man dann
 * hat: Woran liegt es – und was muss ich tun?
 *
 * Jede Prüfung nennt bei einem Fehlschlag den nächsten Schritt. Eine Meldung
 * ohne Handlungsanweisung hilft niemandem weiter, der nicht ohnehin schon
 * weiß, wie Supabase aufgebaut ist.
 */

/** Tabellen, ohne die das Teilen nicht funktioniert. */
const GETEILTE_TABELLEN = ['households', 'household_members', 'shop_items', 'pantry_items'] as const
const PRIVATE_TABELLEN = ['txs', 'pots', 'challenges'] as const
/** Später ergänzt – ihr Fehlen ist kein Grund zur Panik, nur ein Hinweis. */
const SPAETERE_TABELLEN = ['notes', 'shop_templates', 'recurring_txs'] as const

export type CheckState = 'ok' | 'warnung' | 'fehler' | 'uebersprungen'

export interface CheckResult {
  label: string
  state: CheckState
  /** Was gerade gilt – oder was zu tun ist. */
  detail: string
}

/* --- Fehler deuten --------------------------------------------------------- */

interface PostgrestLikeError {
  code?: string
  message?: string
}

/**
 * Fehlt die Tabelle?
 *
 * PostgREST meldet `42P01` („undefined_table“). Weil die Fassungen sich in der
 * Formulierung unterscheiden, wird zusätzlich der Wortlaut geprüft.
 */
export function istTabelleFehlt(error: PostgrestLikeError | null | undefined): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const text = (error.message ?? '').toLowerCase()
  return text.includes('does not exist') || text.includes('could not find the table')
}

/** Greifen die Zugriffsregeln – oder sperren sie zu Unrecht? */
export function istZugriffVerweigert(error: PostgrestLikeError | null | undefined): boolean {
  if (!error) return false
  if (error.code === '42501' || error.code === 'PGRST301') return true
  const text = (error.message ?? '').toLowerCase()
  return text.includes('permission denied') || text.includes('row-level security')
}

/** Kam die Anfrage überhaupt an? */
export function istNetzfehler(error: PostgrestLikeError | null | undefined): boolean {
  if (!error) return false
  const text = (error.message ?? '').toLowerCase()
  return (
    text.includes('failed to fetch') ||
    text.includes('networkerror') ||
    text.includes('load failed') ||
    text.includes('fetch failed')
  )
}

/**
 * Einen Fehler in einen Satz übersetzen, der weiterhilft.
 *
 * Bewusst mit dem nächsten Schritt statt mit der technischen Ursache: „Kein
 * Kontakt zum Server“ schickt in die falsche Richtung, wenn der Kontakt steht
 * und bloß die Tabellen fehlen.
 */
export function erklaereFehler(error: PostgrestLikeError | null | undefined): string {
  if (!error) return 'Unbekannter Fehler.'
  if (istTabelleFehlt(error)) {
    return 'Die Tabellen fehlen. Spiel supabase/schema.sql im SQL-Editor deines Projekts ein.'
  }
  if (istZugriffVerweigert(error)) {
    return 'Der Zugriff wird verweigert. Spiel supabase/schema.sql erneut ein – dort stehen die Zugriffsregeln.'
  }
  if (istNetzfehler(error)) {
    return 'Keine Verbindung. Prüf das Netz und die hinterlegte Projekt-Adresse.'
  }
  return error.message ?? 'Das hat nicht geklappt.'
}

/* --- Die Prüfung ----------------------------------------------------------- */

export interface DiagnoseInput {
  client: SupabaseClient | null
  configured: boolean
  userId: string | null
  householdId: string | null
}

/**
 * Eine Abfrage ausführen, ohne dass eine Ausnahme die Prüfung abwürgt.
 *
 * Bricht die Verbindung weg, wirft der Client statt einen Fehler zurückzugeben.
 * Ungefangen bliebe die ganze Liste leer – und ausgerechnet im Fall „kein
 * Netz“, für den man die Prüfung überhaupt aufruft, stünde nichts da.
 */
async function sicher<T>(
  aufruf: () => PromiseLike<{ data: T | null; error: unknown; count?: number | null }>,
): Promise<{ data: T | null; error: PostgrestLikeError | null; count?: number | null }> {
  try {
    const result = await aufruf()
    return {
      data: result.data,
      error: (result.error as PostgrestLikeError | null) ?? null,
      count: result.count ?? null,
    }
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : String(thrown)
    // Eine geworfene Ausnahme aus dem Netzweg als Netzfehler kenntlich machen,
    // damit die Deutung weiter unten greift.
    return { data: null, error: { message: message || 'Failed to fetch' } }
  }
}

/**
 * Der Reihe nach durchgehen und für jeden Punkt sagen, wie es steht.
 *
 * Bricht nicht beim ersten Fehler ab: Wer sehen will, wie weit es trägt, will
 * die ganze Liste – sonst löst man einen Punkt nach dem anderen und startet
 * jedes Mal neu.
 */
export async function pruefeVerbindung(input: DiagnoseInput): Promise<CheckResult[]> {
  const { client, configured, userId, householdId } = input
  const out: CheckResult[] = []

  out.push(
    configured && client
      ? { label: 'Zugangsdaten', state: 'ok', detail: 'Projekt-Adresse und Schlüssel sind hinterlegt.' }
      : {
          label: 'Zugangsdaten',
          state: 'fehler',
          detail: 'Es fehlen VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY. Ohne sie läuft die App nur auf diesem Gerät.',
        },
  )

  if (!configured || !client) {
    for (const label of ['Server erreichbar', 'Angemeldet', 'Tabellen', 'Haushalt']) {
      out.push({ label, state: 'uebersprungen', detail: 'Ohne Zugangsdaten nicht prüfbar.' })
    }
    return out
  }

  // Erreichbarkeit und Tabellen zugleich: Eine einzelne, sehr kleine Abfrage
  // beantwortet beides. Kommt gar keine Antwort, ist es das Netz.
  const probe = await sicher(() => client.from('households').select('id').limit(1))

  if (probe.error && istNetzfehler(probe.error)) {
    out.push({ label: 'Server erreichbar', state: 'fehler', detail: erklaereFehler(probe.error) })
    for (const label of ['Angemeldet', 'Tabellen', 'Haushalt']) {
      out.push({ label, state: 'uebersprungen', detail: 'Erst muss der Server antworten.' })
    }
    return out
  }

  out.push({ label: 'Server erreichbar', state: 'ok', detail: 'Das Projekt antwortet.' })

  out.push(
    userId
      ? { label: 'Angemeldet', state: 'ok', detail: 'Die Sitzung ist gültig.' }
      : {
          label: 'Angemeldet',
          state: 'fehler',
          detail: 'Noch nicht angemeldet. Trag oben deine E-Mail-Adresse ein und öffne den Link.',
        },
  )

  /* Tabellen einzeln abklopfen. */
  const fehlend: string[] = []
  const gesperrt: string[] = []
  const spaeterFehlend: string[] = []

  const abklopfen = async (tabelle: string, sammelStelle: string[]) => {
    const { error } = await sicher(() => client.from(tabelle).select('id').limit(1))
    if (!error) return
    if (istTabelleFehlt(error)) sammelStelle.push(tabelle)
    else if (istZugriffVerweigert(error)) gesperrt.push(tabelle)
  }

  await Promise.all([
    ...GETEILTE_TABELLEN.map((t) => abklopfen(t, fehlend)),
    ...PRIVATE_TABELLEN.map((t) => abklopfen(t, fehlend)),
    ...SPAETERE_TABELLEN.map((t) => abklopfen(t, spaeterFehlend)),
  ])

  if (fehlend.length > 0) {
    out.push({
      label: 'Tabellen',
      state: 'fehler',
      detail: `Es fehlen ${fehlend.length} Tabellen (${fehlend.slice(0, 3).join(', ')}${fehlend.length > 3 ? ' …' : ''}). Spiel supabase/schema.sql im SQL-Editor ein.`,
    })
  } else if (spaeterFehlend.length > 0) {
    out.push({
      label: 'Tabellen',
      state: 'warnung',
      detail: `Die Grundlage steht, aber ${spaeterFehlend.join(', ')} fehlen. Spiel supabase/schema.sql erneut ein – es ist wiederholbar.`,
    })
  } else {
    out.push({ label: 'Tabellen', state: 'ok', detail: 'Alle Tabellen sind angelegt.' })
  }

  if (gesperrt.length > 0) {
    out.push({
      label: 'Zugriffsregeln',
      state: 'fehler',
      detail: `Der Zugriff auf ${gesperrt.join(', ')} wird verweigert. Spiel supabase/schema.sql erneut ein.`,
    })
  }

  /* Haushalt und tatsächlich lesbare Daten. */
  if (!householdId) {
    out.push({
      label: 'Haushalt',
      state: 'warnung',
      detail: 'Noch kein Haushalt. Leg einen an oder tritt mit einem Code bei – erst dann wird geteilt.',
    })
    return out
  }

  const [liste, vorrat] = await Promise.all([
    sicher(() =>
      client.from('shop_items').select('id', { count: 'exact', head: true }).eq('household_id', householdId),
    ),
    sicher(() =>
      client.from('pantry_items').select('id', { count: 'exact', head: true }).eq('household_id', householdId),
    ),
  ])

  if (liste.error || vorrat.error) {
    out.push({
      label: 'Geteilte Daten',
      state: 'fehler',
      detail: erklaereFehler(liste.error ?? vorrat.error),
    })
  } else {
    out.push({
      label: 'Geteilte Daten',
      state: 'ok',
      detail: `Auf dem Server: ${liste.count ?? 0} Einträge auf der Liste, ${vorrat.count ?? 0} im Vorrat.`,
    })
  }

  return out
}

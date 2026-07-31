import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Zugang zum Server – oder eben nicht.
 *
 * Ohne hinterlegte Zugangsdaten läuft die App vollständig lokal weiter: Alle
 * Bereiche funktionieren, nur das Teilen fehlt. Das ist Absicht. Man soll die
 * App ausprobieren und benutzen können, bevor man irgendwo ein Konto anlegt.
 */

/**
 * Das eingebaute Projekt.
 *
 * Damit läuft jeder Bau ohne weiteres Zutun – auch der aus einer einzelnen
 * Datei, der keine Umgebung mitbringt, in die man etwas eintragen könnte.
 *
 * Dass diese Werte im Quelltext stehen, ist vertretbar und keine Nachlässigkeit:
 * Der publishable key ist für den Browser gemacht und steckt in *jedem*
 * fertigen Bündel im Klartext. Was schützt, sind die Zugriffsregeln in der
 * Datenbank und die Zugangsliste – wer nicht daraufsteht, sieht nichts, und
 * neue Konten legt nur an, wer ins Dashboard kommt. Der secret key dagegen
 * gehört nirgendwohin außer nach Supabase; der Bau bricht ab, wenn er ihn in
 * einem Bündel findet.
 */
const EINGEBAUT = {
  url: 'https://ecflcrigkfyhifekwfxq.supabase.co',
  anonKey: 'sb_publishable_1EpIlW3NxMKtGL4MjF2xtg_aYacqCx3',
}

// Was in der Umgebung steht, geht vor: So lässt sich beim Hoster oder in einer
// lokalen `.env` ein anderes Projekt einsetzen, ohne den Quelltext anzufassen.
// Stünde das eingebaute über `define` im Bauwerkzeug, wäre es umgekehrt – dort
// eingetragene Werte würden stillschweigend übergangen.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || EINGEBAUT.url
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || EINGEBAUT.anonKey

export const cloudConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Angemeldet wird mit Passwort; hierfür braucht es das nicht mehr.
        // Es bleibt trotzdem an: In alten Postfächern liegen noch
        // Anmeldelinks von früher, und wer so einen antippt, soll
        // hineinkommen statt vor einer stummen App zu stehen.
        detectSessionInUrl: true,
      },
    })
  : null

/**
 * Was Supabase beim Anmelden antwortet, in einen Satz übersetzen.
 *
 * Rein und ohne Browser, damit die Zuordnung geprüft werden kann – bei
 * Fehlermeldungen entscheidet sich, ob jemand weiterkommt oder an der falschen
 * Stelle sucht.
 */
export function anmeldeFehlerText(fehler: { code?: string; message?: string } | null): string {
  if (!fehler) return 'Die Anmeldung hat nicht geklappt.'
  const text = (fehler.message ?? '').toLowerCase()

  if (fehler.code === 'invalid_credentials' || text.includes('invalid login credentials')) {
    return 'E-Mail oder Passwort stimmt nicht.'
  }

  // Der einzige Fall, in dem beides stimmt und trotzdem nichts geht. Ohne
  // eigenen Satz probiert man das Passwort immer wieder – und es liegt gar
  // nicht daran.
  if (fehler.code === 'email_not_confirmed' || text.includes('email not confirmed')) {
    return 'Das Konto ist noch nicht bestätigt. In Supabase unter Authentication → Users öffnen und bestätigen.'
  }

  if (fehler.code === 'over_request_rate_limit' || text.includes('rate limit') || text.includes('too many')) {
    return 'Zu viele Versuche. Warte einen Moment und probier es noch einmal.'
  }

  if (
    text.includes('failed to fetch') ||
    text.includes('networkerror') ||
    text.includes('load failed') ||
    text.includes('fetch failed')
  ) {
    return 'Keine Verbindung. Prüf das Netz.'
  }

  // Bei einem abgeschalteten Anbieter oder gesperrten Neuanmeldungen ist die
  // Meldung von Supabase brauchbar genug, um sie durchzureichen.
  return fehler.message ?? 'Die Anmeldung hat nicht geklappt.'
}

/**
 * Einen abgewiesenen Anmeldelink in einen Satz übersetzen.
 *
 * Supabase hängt so etwas hinten an die Adresse: `#error=access_denied&
 * error_code=otp_expired&…`. Ohne diese Auswertung passiert nach dem Antippen
 * eines abgelaufenen Links sichtbar *nichts* – die App öffnet sich, ist aber
 * nicht angemeldet, und niemand weiß, warum.
 *
 * Betrifft nur noch alte Mails: Angemeldet wird mit Passwort, solche Links
 * verschickt die App nicht mehr. Wer einen aus dem Postfach hervorkramt, soll
 * aber erfahren, warum nichts passiert.
 */
export function anmeldeFehlerAusAdresse(hash: string = window.location.hash): string | null {
  const roh = hash.startsWith('#') ? hash.slice(1) : hash
  if (!roh) return null

  let params: URLSearchParams
  try {
    params = new URLSearchParams(roh)
  } catch {
    return null
  }
  if (!params.get('error') && !params.get('error_code')) return null

  const code = params.get('error_code') ?? ''
  if (code === 'otp_expired' || code === 'access_denied') {
    return 'Dieser Anmeldelink ist abgelaufen. Melde dich unten mit E-Mail und Passwort an.'
  }
  const beschreibung = params.get('error_description')
  return beschreibung ? beschreibung.replace(/\+/g, ' ') : 'Die Anmeldung wurde abgewiesen.'
}

/** Den Fehleranhang wieder entfernen, damit ein Neuladen ihn nicht wiederholt. */
export function raeumeAnmeldeFehler(): void {
  try {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  } catch {
    // Ohne History-API bleibt er halt stehen.
  }
}

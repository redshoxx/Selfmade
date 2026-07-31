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
 * Datenbank – jeder sieht nur seinen eigenen Haushalt. Der secret key
 * dagegen gehört nirgendwohin außer nach Supabase; der Bau bricht ab, wenn er
 * ihn in einem Bündel findet.
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
        // Der Anmeldelink von Supabase bringt die Sitzung in der Adresse mit.
        detectSessionInUrl: true,
      },
    })
  : null

/** Adresse, an die der Anmeldelink zurückführt. */
export function redirectTo(): string {
  return `${window.location.origin}${window.location.pathname}`
}

/**
 * Einen abgewiesenen Anmeldelink in einen Satz übersetzen.
 *
 * Supabase hängt so etwas hinten an die Adresse: `#error=access_denied&
 * error_code=otp_expired&…`. Ohne diese Auswertung passiert nach dem Antippen
 * eines abgelaufenen Links sichtbar *nichts* – die App öffnet sich, ist aber
 * nicht angemeldet, und niemand weiß, warum. Genau daran scheitert der zweite
 * Anlauf, wenn die erste Mail zu lange lag.
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
    return 'Der Anmeldelink ist abgelaufen oder wurde schon benutzt. Fordere einen neuen an.'
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

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Zugang zum Server – oder eben nicht.
 *
 * Ohne hinterlegte Zugangsdaten läuft die App vollständig lokal weiter: Alle
 * Bereiche funktionieren, nur das Teilen fehlt. Das ist Absicht. Man soll die
 * App ausprobieren und benutzen können, bevor man irgendwo ein Konto anlegt.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

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

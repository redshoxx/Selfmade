import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Erinnerungen auf dem Sperrbildschirm.
 *
 * Ohne sie wirkt die Ablauf-Ampel nur, wenn man die App zufällig öffnet – und
 * genau dann, wenn man sie bräuchte, denkt man nicht an sie.
 *
 * Zwei Dinge sind hier unbedingt auseinanderzuhalten, weil sie sich völlig
 * verschieden anfühlen: *noch nicht gefragt* und *abgelehnt*. Wer einmal
 * ablehnt, wird vom Browser **nie wieder** gefragt – ein zweiter Tipp auf
 * dieselbe Schaltfläche tut dann stumm nichts. Die App muss in dem Fall
 * sagen, dass es nur noch über die Einstellungen des Telefons geht, statt
 * eine Schaltfläche anzubieten, die ins Leere läuft.
 */

export type PushZustand =
  /** Der Browser kann kein Push – oder die App läuft nicht als eigene Seite. */
  | 'geht-nicht'
  /** Möglich, aber noch nicht eingeschaltet. */
  | 'aus'
  /** Läuft. */
  | 'an'
  /** Abgelehnt – nur noch über die Einstellungen des Telefons zu ändern. */
  | 'abgelehnt'

const VAPID = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''

/** Ist Push hier überhaupt möglich? */
export function pushMoeglich(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    VAPID !== ''
  )
}

export async function pushZustand(): Promise<PushZustand> {
  if (!pushMoeglich()) return 'geht-nicht'
  if (Notification.permission === 'denied') return 'abgelehnt'
  try {
    const reg = await navigator.serviceWorker.ready
    return (await reg.pushManager.getSubscription()) ? 'an' : 'aus'
  } catch {
    return 'aus'
  }
}

/**
 * Der Schlüssel kommt als Base64 mit URL-Alphabet und muss als Bytefolge
 * übergeben werden. Ohne diese Umrechnung lehnt `subscribe` mit einer
 * Meldung ab, die nichts über die Ursache verrät.
 */
function schluesselAlsBytes(base64: string): ArrayBuffer {
  const gefuellt = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const roh = atob(gefuellt)
  const bytes = new Uint8Array(roh.length)
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i)
  return bytes.buffer
}

/**
 * Einschalten. Muss aus einer echten Berührung heraus aufgerufen werden –
 * sonst lehnt iOS die Frage nach der Erlaubnis ohne Rückfrage ab.
 */
export async function pushEinschalten(client: SupabaseClient, userId: string): Promise<PushZustand> {
  if (!pushMoeglich()) return 'geht-nicht'

  const erlaubnis = await Notification.requestPermission()
  if (erlaubnis !== 'granted') return erlaubnis === 'denied' ? 'abgelehnt' : 'aus'

  const reg = await navigator.serviceWorker.ready
  const anmeldung =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      // Ohne das lehnen die Browser ab: Eine Anmeldung, die auch stille
      // Nachrichten erlaubt, wäre ein Weg, Geräte unbemerkt zu verfolgen.
      userVisibleOnly: true,
      applicationServerKey: schluesselAlsBytes(VAPID),
    }))

  const roh = anmeldung.toJSON()
  const { error } = await client.from('push_geraete').upsert(
    {
      endpoint: anmeldung.endpoint,
      user_id: userId,
      p256dh: roh.keys?.p256dh ?? '',
      auth: roh.keys?.auth ?? '',
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error('Das Gerät ließ sich nicht anmelden. Steht das Schema in Supabase?')

  return 'an'
}

/**
 * Ausschalten – beim Server abmelden und im Browser kündigen.
 *
 * Erst der Server: Bliebe das Gerät dort stehen, kämen weiter Nachrichten an
 * eine Anmeldung, die es nicht mehr gibt. Der Push-Dienst antwortet dann mit
 * 410, und die Edge Function räumt es auf – aber erst beim nächsten Mal.
 */
export async function pushAusschalten(client: SupabaseClient): Promise<PushZustand> {
  if (!pushMoeglich()) return 'geht-nicht'
  const reg = await navigator.serviceWorker.ready
  const anmeldung = await reg.pushManager.getSubscription()
  if (!anmeldung) return 'aus'

  await client.from('push_geraete').delete().eq('endpoint', anmeldung.endpoint)
  await anmeldung.unsubscribe()
  return 'aus'
}

/** Was die Oberfläche zu einem Zustand schreibt. */
export function pushText(zustand: PushZustand): string {
  switch (zustand) {
    case 'an':
      return 'Du bekommst abends Bescheid, wenn etwas weg muss.'
    case 'aus':
      return 'Ohne Erinnerung fällt ein ablaufendes Produkt nur auf, wenn du die App öffnest.'
    case 'abgelehnt':
      return 'Du hast Mitteilungen für diese Seite abgelehnt. Der Browser fragt nicht noch einmal – das lässt sich nur in den Einstellungen deines Telefons zurücknehmen.'
    case 'geht-nicht':
      return 'Hier geht das nicht. Auf dem iPhone brauchen Mitteilungen die App vom Home-Bildschirm, nicht den Browser-Tab.'
  }
}

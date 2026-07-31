/**
 * Die abendliche Erinnerung: Was muss weg?
 *
 * Läuft einmal täglich, angestoßen von `cron.schedule` in `schema.sql`.
 *
 * Der Kern der Sache steht **nicht hier**, sondern in `erinnerung()` in
 * `src/lib/pantry.ts` – derselben Funktion, die auch die App benutzt. Wäre die
 * Regel hier ein zweites Mal geschrieben, drifteten die beiden Fassungen
 * auseinander, und dann warnte die App anders als das Telefon. Ein Fehler, den
 * niemand bemerkt, weil beide für sich plausibel aussehen.
 *
 * Aufsetzen (einmalig):
 *
 *   npx web-push generate-vapid-keys
 *   supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:du@…
 *   supabase functions deploy ablauf-erinnerung
 *
 * Der private Schlüssel gehört ausschließlich in die Secrets von Supabase –
 * nie ins Repository, nie zu Netlify, nie in ein Bündel.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

import { erinnerung } from '../../../src/lib/pantry.ts'
import type { PantryItem } from '../../../src/lib/types.ts'

interface GeraetZeile {
  endpoint: string
  p256dh: string
  auth: string
}

/** Datenbankzeile → das, womit `erinnerung()` rechnet. */
function ausZeile(row: Record<string, unknown>): PantryItem {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    aisle: String(row.aisle ?? 'sonstiges') as PantryItem['aisle'],
    qty: Number(row.qty ?? 0),
    unit: String(row.unit ?? 'Stück'),
    minQty: Number(row.min_qty ?? 0),
    bestBefore: row.best_before ? String(row.best_before) : null,
    note: String(row.note ?? ''),
    updatedAt: Number(row.updated_at ?? 0),
    deletedAt: row.deleted_at === null || row.deleted_at === undefined ? null : Number(row.deleted_at),
  }
}

Deno.serve(async () => {
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:selfmade@example.com'

  if (!vapidPublic || !vapidPrivate) {
    return Response.json({ fehler: 'VAPID-Schlüssel fehlen in den Secrets.' }, { status: 500 })
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  // Der service-role-Schlüssel steht der Funktion von Supabase selbst zur
  // Verfügung. Nötig ist er, weil hier niemand angemeldet ist – die
  // Zugriffsregeln würden sonst nichts herausgeben.
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: vorratsZeilen, error: vorratsFehler } = await client
    .from('pantry_items')
    .select('*')
    .is('deleted_at', null)
  if (vorratsFehler) return Response.json({ fehler: vorratsFehler.message }, { status: 500 })

  const meldung = erinnerung({ pantryItems: (vorratsZeilen ?? []).map(ausZeile) })

  // Gibt es nichts, kommt nichts. Eine tägliche „alles in Ordnung“-Meldung
  // erzieht dazu, sie zu übersehen – und dann geht die echte mit unter.
  if (!meldung) return Response.json({ verschickt: 0, grund: 'nichts dringend' })

  const { data: geraete, error: geraeteFehler } = await client
    .from('push_geraete')
    .select('endpoint, p256dh, auth')
  if (geraeteFehler) return Response.json({ fehler: geraeteFehler.message }, { status: 500 })

  const nutzlast = JSON.stringify({
    titel: meldung.titel,
    text: meldung.text,
    url: '/?tab=vorrat&filter=ablauf',
  })

  let verschickt = 0
  const veraltet: string[] = []

  for (const geraet of (geraete ?? []) as GeraetZeile[]) {
    try {
      await webpush.sendNotification(
        { endpoint: geraet.endpoint, keys: { p256dh: geraet.p256dh, auth: geraet.auth } },
        nutzlast,
      )
      verschickt++
    } catch (fehler) {
      // 404 und 410 heißen: Diese Anmeldung gibt es nicht mehr – App gelöscht,
      // Browserdaten geleert. Solche Zeilen müssen weg, sonst sammeln sich
      // Karteileichen an, an die jeden Abend vergeblich geschickt wird.
      const status = (fehler as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) veraltet.push(geraet.endpoint)
      else console.error('Zustellung fehlgeschlagen:', status, fehler)
    }
  }

  if (veraltet.length > 0) {
    await client.from('push_geraete').delete().in('endpoint', veraltet)
  }
  if (verschickt > 0) {
    await client
      .from('push_geraete')
      .update({ zuletzt_ok: new Date().toISOString() })
      .not('endpoint', 'in', `(${veraltet.map((e) => `"${e}"`).join(',') || '""'})`)
  }

  return Response.json({
    verschickt,
    aufgeraeumt: veraltet.length,
    titel: meldung.titel,
    produkte: meldung.produkte.length,
  })
})

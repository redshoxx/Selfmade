/**
 * Service Worker: die App startet auch ohne Netz.
 *
 * Zwei Strategien, je nach Anfrage:
 *  - Navigation (das HTML-Grundgerüst): erst Netz, dann Cache. So kommt nach
 *    einer neuen Veröffentlichung sofort die neue Fassung an, statt bis zum
 *    nächsten Neustart eine alte auszuliefern.
 *  - Alles andere (JS, CSS, Symbole): erst Cache, dann Netz. Diese Dateien
 *    tragen einen Hash im Namen und ändern sich nie unter gleichem Namen.
 *
 * Anfragen an Supabase laufen bewusst am Service Worker vorbei – Daten sollen
 * nie aus einem Cache kommen, sonst zeigt die App Bestände von gestern.
 */
const VERSION = 'v2'
const SHELL = `selfmade-shell-${VERSION}`
const ASSETS = `selfmade-assets-${VERSION}`

const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // Einzeln, damit ein fehlendes Symbol nicht die ganze Installation kippt.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL && key !== ASSETS).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

/* --- Erinnerungen ---------------------------------------------------------- */

/**
 * Eine Meldung vom Server anzeigen.
 *
 * Der Inhalt kommt fertig formuliert an – ausgewählt und formuliert wird in
 * `erinnerung()` in `src/lib/pantry.ts`, damit App und Benachrichtigung
 * dieselbe Regel benutzen. Hier wird nur noch dargestellt.
 *
 * `tag` sorgt dafür, dass eine neue Meldung die alte ersetzt statt sich
 * danebenzustellen: Nach einer Woche Urlaub sonst sieben Zettel übereinander.
 */
self.addEventListener('push', (event) => {
  let daten = {}
  try {
    daten = event.data ? event.data.json() : {}
  } catch {
    // Kaputte Nutzlast: lieber eine schlichte Meldung als gar keine.
  }

  event.waitUntil(
    self.registration.showNotification(daten.titel || 'Selfmade', {
      body: daten.text || 'Sieh im Vorrat nach.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'ablauf',
      lang: 'de',
      data: { url: daten.url || '/?tab=vorrat&filter=ablauf' },
    }),
  )
})

/**
 * Antippen führt dorthin, wovon die Meldung handelt.
 *
 * Erst nachsehen, ob die App schon offen ist. Ein zweites Fenster neben einem
 * bestehenden zu öffnen, ist auf dem Telefon nicht nur unnötig – man landet
 * dann in einer zweiten Ausfertigung derselben App.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const ziel = event.notification.data?.url || '/?tab=vorrat&filter=ablauf'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenster) => {
      for (const client of fenster) {
        if (client.url.includes(self.location.origin)) {
          return client.focus().then(() => client.navigate?.(ziel))
        }
      }
      return self.clients.openWindow(ziel)
    }),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Fremde Server (Supabase, Bilder Dritter) bleiben unangetastet.
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html').then((hit) => hit ?? Response.error())),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(ASSETS).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})

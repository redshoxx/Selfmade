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
const VERSION = 'v1'
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

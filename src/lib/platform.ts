import { alsTab } from './types'
import type { Tab } from './types'

/**
 * Kleinigkeiten, die auf dem Telefon den Unterschied machen.
 */

export interface LaunchIntent {
  tab: Tab | null
  /** Direkt das Erfassen-Blatt öffnen. */
  compose: 'ausgabe' | 'einnahme' | null
  /** Vorauswahl im Vorrat. */
  filter: 'ablauf' | null
}

/**
 * Startabsicht aus der Adresse lesen.
 *
 * Android bietet beim langen Tippen auf das App-Symbol Verknüpfungen an
 * (`?tab=geld&neu=ausgabe`). Damit ist eine Ausgabe zwei Berührungen entfernt
 * statt vier – und genau daran entscheidet sich, ob man sie an der Kasse
 * wirklich erfasst.
 */
export function readLaunchIntent(search: string = window.location.search): LaunchIntent {
  const params = new URLSearchParams(search)
  const neu = params.get('neu')
  return {
    // `alsTab` fängt hier das alte `?tab=sparen` ab: Es steckt in den
    // Verknüpfungen, die schon auf einem Home-Bildschirm liegen, und die
    // aktualisiert niemand.
    tab: alsTab(params.get('tab')),
    compose: neu === 'ausgabe' || neu === 'einnahme' ? neu : null,
    filter: params.get('filter') === 'ablauf' ? 'ablauf' : null,
  }
}

/**
 * Adresse säubern, damit ein Neuladen nicht wieder dasselbe Blatt aufmacht.
 *
 * Der Anhang hinter `#` bleibt stehen. Dort bringt der Anmeldelink von
 * Supabase die Sitzung mit, und die wird erst kurz nach dem Start ausgelesen –
 * wer ihn hier wegwirft, meldet niemanden mehr an.
 */
export function clearLaunchIntent(): void {
  try {
    if (!window.location.search) return
    const rest = `${window.location.pathname}${window.location.hash}`
    window.history.replaceState(null, '', rest)
  } catch {
    // Ohne History-API halt nicht.
  }
}

/**
 * Höhe der eingeblendeten Tastatur als CSS-Variable, und eine Klasse dazu.
 *
 * Auf iOS schiebt die Tastatur das Layout nicht nach oben, sondern legt sich
 * darüber – die Eingabezeile am unteren Rand läge sonst dahinter und man tippt
 * blind. `visualViewport` verrät, wie viel fehlt.
 *
 * Die Klasse `tastatur` auf `<html>` ist der zweite Teil, und ohne ihn stimmt
 * die Rechnung nicht: Die Reiterleiste steht unter der Eingabezeile und behält
 * ihre 83 Punkte, auch wenn sie längst hinter der Tastatur liegt. Die
 * Eingabezeile schwebte dadurch genau diese 83 Punkte über der Tastaturkante.
 * Das Stylesheet nimmt die Leiste anhand der Klasse aus dem Fluss – so, wie
 * eine echte App es auch macht.
 */
export function trackKeyboardInset(): () => void {
  const viewport = window.visualViewport
  if (!viewport) return () => {}

  const update = () => {
    const hidden = window.innerHeight - viewport.height - viewport.offsetTop
    // Kleine Abweichungen entstehen durch die Adressleiste, nicht durch die
    // Tastatur. Erst ab 80 Pixeln ist wirklich eine aufgegangen.
    const inset = hidden > 80 ? hidden : 0
    document.documentElement.style.setProperty('--keyboard', `${Math.round(inset)}px`)
    document.documentElement.classList.toggle('tastatur', inset > 0)
  }

  update()
  viewport.addEventListener('resize', update)
  viewport.addEventListener('scroll', update)
  return () => {
    viewport.removeEventListener('resize', update)
    viewport.removeEventListener('scroll', update)
    document.documentElement.style.setProperty('--keyboard', '0px')
    document.documentElement.classList.remove('tastatur')
  }
}

/**
 * Kurzes Rütteln als Rückmeldung.
 *
 * Android kann das über die Vibration-API. iOS im Browser nicht – dort passiert
 * schlicht nichts, und das ist in Ordnung: Die Rückmeldung ist eine Zugabe,
 * keine Bedingung.
 */
export function tick(enabled: boolean): void {
  if (!enabled) return
  try {
    navigator.vibrate?.(8)
  } catch {
    // Manche Browser verbieten es ohne vorherige Geste.
  }
}

/** Läuft die App vom Homescreen statt im Browser-Tab? */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // Safari auf iOS meldet es über eine eigene Eigenschaft.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Service Worker anmelden – erst nach dem Laden, damit er nichts ausbremst. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Ohne Offline-Fähigkeit läuft die App trotzdem.
    })
  })
}

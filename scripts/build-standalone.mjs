/**
 * Baut die App zu einer einzigen HTML-Datei zusammen.
 *
 * Wozu: Zum Herzeigen und Ausprobieren genügt dann eine Datei – doppelklicken,
 * fertig, ohne Server und ohne Installation. Auch praktisch, um die App per
 * Nachricht weiterzugeben.
 *
 * Ohne hinterlegte Zugangsdaten läuft sie darin rein lokal: Alle Bereiche
 * funktionieren, nur das Teilen fehlt.
 *
 *   npm run build:single   mit den Zugangsdaten aus .env
 *   npm run build:demo     ohne – zum Weitergeben
 *
 * Zum Herzeigen ist `build:demo` der richtige Weg. Die Zugangsdaten stehen im
 * fertigen Bündel im Klartext; wer die Datei bekommt, könnte sich sonst am
 * eigenen Supabase-Projekt anmelden und dort Haushalte anlegen. Der Schlüssel
 * ist zwar für den Browser gedacht, aber die Datei soll ja weitergegeben
 * werden – und dann liest sie jeder.
 *
 * Schreibt:
 *   dist-single/selfmade.html   vollständige Seite
 *   dist-single/body.html       nur der Rumpf, für Umgebungen, die ihr eigenes
 *                               Grundgerüst mitbringen
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const OUT = join(ROOT, 'dist-single')

/**
 * `</script>` in einer Zeichenkette im Code würde den umschließenden
 * Script-Block vorzeitig beenden – der Browser bräche mitten im Bündel ab.
 * Der Schrägstrich wird deshalb maskiert; für JavaScript bleibt es dieselbe
 * Zeichenkette.
 */
const safe = (code) => code.replace(/<\/script>/gi, '<\\/script>')

const html = readFileSync(join(DIST, 'index.html'), 'utf8')

const cssFile = html.match(/href="\/(assets\/[^"]+\.css)"/)?.[1]
const jsFile = html.match(/src="\/(assets\/[^"]+\.js)"/)?.[1]
if (!jsFile) throw new Error('Kein Bündel in dist/index.html gefunden – erst `npm run build` laufen lassen.')

const css = cssFile ? readFileSync(join(DIST, cssFile), 'utf8') : ''
const js = readFileSync(join(DIST, jsFile), 'utf8')

const body = `<style>
${css}
</style>

<div id="root"></div>

<script type="module">
${safe(js)}
</script>
`

const page = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#f7f7f5" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#101012" media="(prefers-color-scheme: dark)" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <title>Selfmade</title>
  </head>
  <body>
${body}
  </body>
</html>
`

/**
 * Sicherung: Im Demo-Bau dürfen keine Zugangsdaten stecken.
 *
 * Die Datei wird weitergereicht, und im fertigen Bündel steht alles im
 * Klartext. Wäre der Schlüssel darin, könnte sich jeder Empfänger am eigenen
 * Supabase-Projekt anmelden und dort Haushalte anlegen.
 *
 * Ein stiller Fehlgriff wäre hier teuer, deshalb bricht der Bau lieber ab:
 * Leere Werte in `.env.demo` können durch eine falsche Reihenfolge beim Laden
 * unwirksam werden, und das sieht man dem Ergebnis nicht an.
 */
if (process.argv.includes('--demo') || process.env.NODE_ENV === 'demo' || isDemoBuild()) {
  const verdaechtig = [/sb_publishable_[A-Za-z0-9_-]+/, /https:\/\/[a-z0-9]{20}\.supabase\.co/]
  for (const muster of verdaechtig) {
    const treffer = body.match(muster)
    if (treffer) {
      console.error('\nAbbruch: Im Demo-Bau stecken Zugangsdaten.')
      console.error('Gefunden:', treffer[0].slice(0, 24) + '…')
      console.error('Prüfe, ob `.env.demo` geladen wurde (vite build --mode demo).\n')
      process.exit(1)
    }
  }
}

/** Wurde mit `--mode demo` gebaut? Vite schreibt den Modus nicht ins Ergebnis,
 *  deshalb am Aufruf ablesen. */
function isDemoBuild() {
  return (process.env.npm_lifecycle_event ?? '') === 'build:demo'
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'selfmade.html'), page)
writeFileSync(join(OUT, 'body.html'), body)

const kb = (text) => `${Math.round(Buffer.byteLength(text) / 1024)} kB`
console.log('geschrieben: dist-single/selfmade.html', kb(page))
console.log('geschrieben: dist-single/body.html    ', kb(body))

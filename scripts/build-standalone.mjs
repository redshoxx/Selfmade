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
 *   npm run build && node scripts/build-standalone.mjs
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

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'selfmade.html'), page)
writeFileSync(join(OUT, 'body.html'), body)

const kb = (text) => `${Math.round(Buffer.byteLength(text) / 1024)} kB`
console.log('geschrieben: dist-single/selfmade.html', kb(page))
console.log('geschrieben: dist-single/body.html    ', kb(body))

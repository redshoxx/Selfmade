import { describe, expect, it } from 'vitest'

/**
 * Kontrast als Test, nicht als Behauptung.
 *
 * Im Stylesheet stand jahrelang ein Kommentar mit nachgerechneten
 * Verhältnissen. Kommentare altern: Als der Farbsatz aus dem Entwurf kam,
 * stimmten die Zahlen darin nicht mehr, und niemand hätte es gemerkt.
 *
 * Deshalb liest dieser Test die Werte aus `styles.css` und rechnet selbst –
 * nach der Formel aus WCAG 2. Wer künftig eine Farbe ändert und dabei unter
 * die Schwelle rutscht, erfährt es hier statt bei jemandem, der die App bei
 * Sonnenlicht nicht mehr lesen kann.
 *
 * Maßgeblich ist der Kontrast gegen die *Kartenfläche*, nicht gegen den
 * Hintergrund: Text steht fast immer auf einer Karte, und dort ist der
 * Abstand kleiner.
 */

// `?inline` statt `?raw`: Vite behandelt CSS gesondert und gibt den Text nur
// über diese Abfrage heraus. Dass Vitest die Datei überhaupt lädt statt sie zu
// stuben, steht in `vite.config.ts` unter `test.css`.
const CSS = import.meta.glob('../styles.css', {
  query: '?inline',
  import: 'default',
  eager: true,
}) as Record<string, string>

const quelle = Object.values(CSS)[0]!

function token(name: string): string {
  const treffer = quelle.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))
  if (!treffer) throw new Error(`--${name} steht nicht als Sechsstelliger in styles.css`)
  return treffer[1]!
}

/** Relative Helligkeit nach WCAG 2. */
function helligkeit(hex: string): number {
  const teile = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const linear = teile.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!
}

function verhaeltnis(a: string, b: string): number {
  const [x, y] = [helligkeit(a), helligkeit(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

describe('Lesbarkeit der Farben', () => {
  for (const [thema, praefix] of [
    ['hell', 'l'],
    ['dunkel', 'd'],
  ] as const) {
    describe(thema, () => {
      const karte = () => token(`${praefix}-surface`)

      // 4,5 : 1 ist die Schwelle für gewöhnlichen Fließtext (WCAG AA).
      it.each(['text', 'text-2', 'accent'])('%s trägt Fließtext auf der Karte', (rolle) => {
        expect(verhaeltnis(token(`${praefix}-${rolle}`), karte())).toBeGreaterThanOrEqual(4.5)
      })

      // text-3 steht nur an kleinen Beschriftungen und nie allein für eine
      // Aussage. 3 : 1 ist dort die Grenze, unter der es zur Zierde verkommt.
      it('text-3 bleibt über der Grenze für Beiwerk', () => {
        expect(verhaeltnis(token(`${praefix}-text-3`), karte())).toBeGreaterThanOrEqual(3)
      })

      // Die Zwillinge: Sie stehen genau dort, wo good/warn/bad kleine Schrift
      // tragen – Hinweise, Etiketten, Preise.
      it.each(['good-text', 'warn-text', 'bad-text'])('%s trägt kleine Schrift', (rolle) => {
        expect(verhaeltnis(token(`${praefix}-${rolle}`), karte())).toBeGreaterThanOrEqual(4.5)
      })

      // Sonst verschmelzen Karten auf einem OLED-Bildschirm mit dem Grund.
      it('Karte hebt sich vom Grund ab', () => {
        expect(verhaeltnis(karte(), token(`${praefix}-bg`))).toBeGreaterThan(1.05)
      })
    })
  }

  it('hält den Akzent auch als Fläche mit weißer Schrift lesbar', () => {
    // `.btn-primary` und `.laden-vor` setzen Weiß auf den Akzent.
    expect(verhaeltnis(token('l-accent'), '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })
})

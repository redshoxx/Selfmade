import { describe, expect, it } from 'vitest'

/**
 * `pantry.ts` läuft nicht nur im Browser.
 *
 * Die Edge Function, die abends die Erinnerung verschickt, importiert dieselbe
 * Datei – damit App und Telefon nach derselben Regel entscheiden, was
 * „dringend“ heißt. Zwei Fassungen derselben Regel driften auseinander, und
 * der Fehler fällt niemandem auf, weil beide für sich plausibel aussehen.
 *
 * Der Preis dafür: Im Abhängigkeitspfad von `pantry.ts` darf nichts stehen,
 * was es nur im Browser gibt. Ein `window.localStorage` an falscher Stelle
 * brächte die Funktion zu Fall – nicht hier, sondern nachts auf dem Server,
 * still. Genau deshalb steht `live()` in `entity.ts` und nicht in `store.ts`.
 */

// Über Vite statt über `node:fs`: Der Test bleibt damit frei von Node-Typen,
// die dieses Projekt sonst nirgends braucht.
const QUELLEN = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

const NUR_IM_BROWSER = ['window', 'document', 'localStorage', 'sessionStorage', 'navigator']

/** Kommentare weg – dort dürfen die Wörter als Prosa vorkommen. */
function ohneKommentare(quelltext: string): string {
  return quelltext.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

function quelle(modul: string): string {
  const text = QUELLEN[`./${modul}.ts`]
  if (text === undefined) throw new Error(`Kein Quelltext für ${modul}.ts gefunden`)
  return text
}

function abhaengigkeiten(start: string): string[] {
  const gesehen = new Set<string>()
  const folgen = (modul: string) => {
    if (gesehen.has(modul)) return
    gesehen.add(modul)
    for (const treffer of quelle(modul).matchAll(/from '\.\/([a-zA-Z]+)'/g)) folgen(treffer[1]!)
  }
  folgen(start)
  return [...gesehen]
}

describe('Was auch auf dem Server läuft', () => {
  it('kommt ohne Browser aus', () => {
    for (const modul of abhaengigkeiten('pantry')) {
      const quelltext = ohneKommentare(quelle(modul))
      for (const wort of NUR_IM_BROWSER) {
        expect(
          new RegExp(`\\b${wort}\\b`).test(quelltext),
          `src/lib/${modul}.ts benutzt „${wort}“ – das gibt es in der Edge Function nicht. ` +
            'Zieh das Nötige in ein Modul ohne Browser-Bezug, so wie live() in entity.ts.',
        ).toBe(false)
      }
    }
  })

  it('zieht den Speicher des Browsers nicht mit herein', () => {
    // `store.ts` ist die Grenze: Dort liegt localStorage, und dort darf es
    // auch liegen – nur eben nicht im Pfad der Rechenlogik.
    expect(abhaengigkeiten('pantry')).not.toContain('store')
  })
})

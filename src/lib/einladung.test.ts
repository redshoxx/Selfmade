import { beforeEach, describe, expect, it } from 'vitest'
import {
  codeAusAdresse,
  einladungsLink,
  gemerkteEinladung,
  merkeEinladung,
  offeneEinladung,
  vergissEinladung,
} from './einladung'

/**
 * Der Einladungslink ist der Weg, den die Freundin geht. Was hier schiefgeht,
 * merkt man nicht beim Entwickeln, sondern am Küchentisch: „Bei mir passiert
 * nichts.“
 */

describe('codeAusAdresse', () => {
  it('liest den Code aus dem Link', () => {
    expect(codeAusAdresse('?beitreten=K7M-2QD')).toBe('K7M-2QD')
  })

  it('nimmt auch schludrige Schreibweisen', () => {
    // Der Link landet in einer Nachricht, wird kopiert, verliert unterwegs
    // Bindestrich oder Großschreibung. Das darf ihn nicht ungültig machen.
    expect(codeAusAdresse('?beitreten=k7m2qd')).toBe('K7M-2QD')
    expect(codeAusAdresse('?tab=einkauf&beitreten=k7m%202qd')).toBe('K7M-2QD')
  })

  it('weist halbe Codes ab', () => {
    // Ein abgeschnittener Link soll nicht als Einladung gelten und später mit
    // „gibt es nicht“ abgewiesen werden – das sähe nach einem Fehler der App
    // aus, obwohl der Link kaputt war.
    expect(codeAusAdresse('?beitreten=K7M')).toBeNull()
    expect(codeAusAdresse('?beitreten=')).toBeNull()
    expect(codeAusAdresse('')).toBeNull()
    expect(codeAusAdresse('?tab=geld')).toBeNull()
  })

  it('ignoriert Zeichen, die es in Codes nicht gibt', () => {
    // I, O, 0 und 1 kommen im Alphabet nicht vor. Wer sie tippt, hat sich
    // verlesen – und weil beide Kandidaten der Verwechslung fehlen, lässt
    // sich nicht erraten, was gemeint war.
    expect(codeAusAdresse('?beitreten=K7M-2QDO')).toBe('K7M-2QD')
  })
})

describe('einladungsLink', () => {
  it('hängt den Code an die Adresse der App', () => {
    expect(einladungsLink('K7M-2QD', 'https://selfmade.netlify.app')).toBe(
      'https://selfmade.netlify.app/?beitreten=K7M-2QD',
    )
  })

  it('verträgt einen abschließenden Schrägstrich', () => {
    expect(einladungsLink('K7M-2QD', 'https://selfmade.netlify.app/')).toBe(
      'https://selfmade.netlify.app/?beitreten=K7M-2QD',
    )
  })

  it('lässt sich wieder auslesen', () => {
    // Die beiden Seiten müssen zusammenpassen; sonst führt der eigene Link
    // ins Leere.
    const link = einladungsLink('K7M-2QD', 'https://example.com')
    expect(codeAusAdresse(new URL(link).search)).toBe('K7M-2QD')
  })
})

describe('über die Anmeldung hinweg merken', () => {
  // Ein winziger Ersatz für den Speicher des Browsers. Bewusst kein jsdom:
  // Die Rechenlogik dieser App läuft ohne Browser, und das soll so bleiben –
  // eine ganze Browser-Nachbildung für vier Zeilen Speicher wäre ein hoher
  // Preis für eine kleine Bequemlichkeit.
  beforeEach(() => {
    const ablage = new Map<string, string>()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => ablage.get(key) ?? null,
          setItem: (key: string, wert: string) => void ablage.set(key, wert),
          removeItem: (key: string) => void ablage.delete(key),
        },
      },
    })
  })

  it('behält den Code, bis er eingelöst ist', () => {
    // Der Umweg über die Anmeldung führt ohne die ursprüngliche Adresse
    // zurück. Ohne diesen Speicher wäre die Einladung dann verloren.
    merkeEinladung('K7M-2QD')
    expect(gemerkteEinladung()).toBe('K7M-2QD')
    vergissEinladung()
    expect(gemerkteEinladung()).toBeNull()
  })

  it('nimmt den Code aus der Adresse und legt ihn weg', () => {
    expect(offeneEinladung('?beitreten=K7M-2QD')).toBe('K7M-2QD')
    // Zweiter Aufruf ohne Adresse: der Code steht immer noch bereit.
    expect(offeneEinladung('')).toBe('K7M-2QD')
  })

  it('ist mehrfach aufrufbar, ohne sich zu widersprechen', () => {
    // React baut im Entwicklungsmodus alles doppelt auf.
    expect(offeneEinladung('?beitreten=K7M-2QD')).toBe('K7M-2QD')
    expect(offeneEinladung('?beitreten=K7M-2QD')).toBe('K7M-2QD')
  })

  it('liefert nichts, wenn nichts anliegt', () => {
    expect(offeneEinladung('')).toBeNull()
  })
})

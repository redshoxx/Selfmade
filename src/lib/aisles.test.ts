import { describe, expect, it } from 'vitest'
import { AISLES, aisle, guessAisle } from './aisles'

describe('guessAisle', () => {
  it('erkennt die Alltagseinkäufe', () => {
    expect(guessAisle('Milch')).toBe('kuehl')
    expect(guessAisle('Vollmilch 3,5%')).toBe('kuehl')
    expect(guessAisle('Bananen')).toBe('obst')
    expect(guessAisle('Klopapier')).toBe('haushalt')
    expect(guessAisle('Hackfleisch')).toBe('fleisch')
    expect(guessAisle('Spaghetti')).toBe('trocken')
    expect(guessAisle('Duschgel')).toBe('drogerie')
    expect(guessAisle('Mineralwasser')).toBe('getraenke')
  })

  it('ist unempfindlich gegen Groß- und Kleinschreibung und Leerraum', () => {
    expect(guessAisle('  BUTTER ')).toBe('kuehl')
    expect(guessAisle('brot')).toBe('backwaren')
  })

  it('lässt Zusammensetzungen und Mehrzahl durchgehen', () => {
    expect(guessAisle('Äpfel')).toBe('obst')
    expect(guessAisle('Nudelauflauf')).toBe('trocken')
    expect(guessAisle('Zahnbürsten')).toBe('drogerie')
  })

  it('schlägt nicht mitten im Wort an', () => {
    // „eis“ steckt in „Fleisch“, „ei“ in „Eintopf“ – beides darf nicht zählen.
    expect(guessAisle('Fleischsalat')).toBe('fleisch')
    expect(guessAisle('Reis')).toBe('trocken')
  })

  it('lässt bei mehreren Treffern das genauere Stichwort gewinnen', () => {
    // „erdnussbutter“ ist länger als „butter“ und damit die bessere Auskunft.
    expect(guessAisle('Erdnussbutter')).toBe('trocken')
    expect(guessAisle('Butter')).toBe('kuehl')
  })

  it('fällt auf Sonstiges zurück, statt zu raten', () => {
    expect(guessAisle('Grillanzünder')).toBe('sonstiges')
    expect(guessAisle('')).toBe('sonstiges')
  })
})

describe('aisle', () => {
  it('liefert zu jeder Kennung eine Abteilung', () => {
    for (const a of AISLES) expect(aisle(a.id).id).toBe(a.id)
  })

  it('fällt bei unbekannter Kennung auf Sonstiges zurück', () => {
    // Kann bei Daten aus einer neueren Fassung des Haushalts vorkommen.
    expect(aisle('gibtsnicht' as never).id).toBe('sonstiges')
  })

  it('warnt bei verderblicher Ware früher als bei Konserven', () => {
    expect(aisle('fleisch').warnDays).toBeLessThan(aisle('konserven').warnDays)
    expect(aisle('obst').urgentDays).toBeLessThanOrEqual(aisle('kuehl').urgentDays)
  })
})

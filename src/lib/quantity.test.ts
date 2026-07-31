import { describe, expect, it } from 'vitest'
import { bumpQuantity, isBumpable, mergeQuantities, parseEntry, splitQuantity } from './quantity'

describe('parseEntry', () => {
  it('liest die Menge vor dem Namen', () => {
    expect(parseEntry('2 Milch')).toEqual({ name: 'Milch', qty: '2' })
    expect(parseEntry('12 Eier')).toEqual({ name: 'Eier', qty: '12' })
  })

  it('liest Menge mit Einheit', () => {
    expect(parseEntry('500g Mehl')).toEqual({ name: 'Mehl', qty: '500 g' })
    expect(parseEntry('500 g Mehl')).toEqual({ name: 'Mehl', qty: '500 g' })
    expect(parseEntry('1,5 l Milch')).toEqual({ name: 'Milch', qty: '1,5 l' })
    expect(parseEntry('2 kg Kartoffeln')).toEqual({ name: 'Kartoffeln', qty: '2 kg' })
  })

  it('vereinheitlicht die Schreibweise der Einheit', () => {
    expect(parseEntry('500G Mehl').qty).toBe('500 g')
    expect(parseEntry('2 stk Butter').qty).toBe('2 Stück')
    expect(parseEntry('3 pck Nudeln').qty).toBe('3 Packung')
    expect(parseEntry('2 dosen Mais').qty).toBe('2 Dose')
  })

  it('versteht die Mal-Schreibweise', () => {
    expect(parseEntry('3x Joghurt')).toEqual({ name: 'Joghurt', qty: '3' })
    expect(parseEntry('3 x Joghurt')).toEqual({ name: 'Joghurt', qty: '3' })
  })

  it('liest die Menge auch hinter dem Namen', () => {
    expect(parseEntry('Milch 2')).toEqual({ name: 'Milch', qty: '2' })
    expect(parseEntry('Mehl 500 g')).toEqual({ name: 'Mehl', qty: '500 g' })
  })

  it('lässt einen Namen ohne Menge in Ruhe', () => {
    expect(parseEntry('Milch')).toEqual({ name: 'Milch', qty: '' })
    expect(parseEntry('Toilettenpapier')).toEqual({ name: 'Toilettenpapier', qty: '' })
  })

  it('hält mehrteilige Namen zusammen', () => {
    expect(parseEntry('2 Griechischer Joghurt')).toEqual({ name: 'Griechischer Joghurt', qty: '2' })
    expect(parseEntry('Frische Milch')).toEqual({ name: 'Frische Milch', qty: '' })
  })

  it('hält Prozentangaben aus der Menge heraus', () => {
    // Sonst würde aus „H-Milch 3,5 %“ ein Eintrag „H-Milch“ mit Menge 3,5.
    expect(parseEntry('H-Milch 3,5 %')).toEqual({ name: 'H-Milch 3,5 %', qty: '' })
    expect(parseEntry('0 % Joghurt')).toEqual({ name: '0 % Joghurt', qty: '' })
  })

  it('deutet Produktbezeichnungen nicht als Menge', () => {
    // „B12“ ist keine Einheit, die Zahl gehört zum Namen.
    expect(parseEntry('Vitamin B12')).toEqual({ name: 'Vitamin B12', qty: '' })
    expect(parseEntry('Cola Zero')).toEqual({ name: 'Cola Zero', qty: '' })
  })

  it('macht aus einer Einheit ohne Ware keinen leeren Eintrag', () => {
    // „2 Packungen“ allein sagt nicht, wovon – dann ist das der Name.
    expect(parseEntry('2 Packungen')).toEqual({ name: '2 Packungen', qty: '' })
    expect(parseEntry('500 g')).toEqual({ name: '500 g', qty: '' })
  })

  it('verträgt Leerraum und leere Eingaben', () => {
    expect(parseEntry('   2    Milch  ')).toEqual({ name: 'Milch', qty: '2' })
    expect(parseEntry('')).toEqual({ name: '', qty: '' })
    expect(parseEntry('   ')).toEqual({ name: '', qty: '' })
  })

  it('lässt eine Null keine Menge werden', () => {
    // „0 Milch“ ergibt keinen Sinn – dann lieber alles als Name.
    expect(parseEntry('0 Milch').qty).toBe('')
  })
})

describe('bumpQuantity', () => {
  it('zählt ganze Zahlen in Einerschritten', () => {
    expect(bumpQuantity('2', 1)).toBe('3')
    expect(bumpQuantity('3', -1)).toBe('2')
  })

  it('behält die Einheit', () => {
    expect(bumpQuantity('500 g', 1)).toBe('501 g')
    expect(bumpQuantity('2 Packung', 1)).toBe('3 Packung')
  })

  it('geht bei Kommazahlen in halben Schritten', () => {
    // Ein Einerschritt auf „1,5 l“ führte sonst zu krummen Werten.
    expect(bumpQuantity('1,5 l', 1)).toBe('2 l')
    expect(bumpQuantity('2,5 l', -1)).toBe('2 l')
  })

  it('zählt aus dem Leeren heraus', () => {
    expect(bumpQuantity('', 1)).toBe('2')
    expect(bumpQuantity('', -1)).toBe('1')
  })

  it('geht nicht unter eins', () => {
    // Wer nichts mehr braucht, streicht den Eintrag – „0 Milch“ hilft niemandem.
    expect(bumpQuantity('1', -1)).toBe('1')
  })

  it('lässt Mengen ohne führende Zahl unangetastet', () => {
    expect(bumpQuantity('ein Karton', 1)).toBe('ein Karton')
  })

  it('erzeugt keine Fließkomma-Reste', () => {
    expect(bumpQuantity('1,5 l', 1)).not.toContain('0000')
    expect(bumpQuantity('0,5 kg', 1)).toBe('1 kg')
  })
})

describe('isBumpable', () => {
  it('erkennt, woran sich drehen lässt', () => {
    expect(isBumpable('2')).toBe(true)
    expect(isBumpable('500 g')).toBe(true)
    expect(isBumpable('')).toBe(true)
    expect(isBumpable('ein Karton')).toBe(false)
    expect(isBumpable('nach Bedarf')).toBe(false)
  })
})

describe('mergeQuantities', () => {
  it('zählt gleiche Einheiten zusammen', () => {
    expect(mergeQuantities('2', '1')).toBe('3')
    expect(mergeQuantities('500 g', '250 g')).toBe('750 g')
    expect(mergeQuantities('1,5 l', '0,5 l')).toBe('2 l')
  })

  it('übernimmt, was da ist, wenn eine Seite leer bleibt', () => {
    expect(mergeQuantities('', '2')).toBe('2')
    expect(mergeQuantities('2', '')).toBe('2')
    expect(mergeQuantities('', '')).toBe('')
  })

  it('behält bei ungleichen Einheiten die vorhandene Angabe', () => {
    // 500 g und 2 Packungen lassen sich nicht addieren – und geraten wird nicht.
    expect(mergeQuantities('500 g', '2 Packung')).toBe('500 g')
    expect(mergeQuantities('2 Stück', '1 kg')).toBe('2 Stück')
  })

  it('lässt Freitext unangetastet', () => {
    expect(mergeQuantities('nach Bedarf', '2')).toBe('nach Bedarf')
  })
})

describe('splitQuantity', () => {
  it('zerlegt in Zahl und Einheit', () => {
    expect(splitQuantity('500 g')).toEqual({ amount: 500, unit: 'g' })
    expect(splitQuantity('1,5 l')).toEqual({ amount: 1.5, unit: 'l' })
    expect(splitQuantity('2')).toEqual({ amount: 2, unit: '' })
    expect(splitQuantity('  3 Packung ')).toEqual({ amount: 3, unit: 'Packung' })
  })

  it('gibt auf, wo nichts zu holen ist', () => {
    // Lieber `null` als geraten: Der Vorrat bucht daraufhin 1, und das ist
    // eine bewusste Entscheidung an einer Stelle statt einer geratenen hier.
    expect(splitQuantity('ein Karton')).toBeNull()
    expect(splitQuantity('')).toBeNull()
  })
})

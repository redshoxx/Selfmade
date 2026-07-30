import { describe, expect, it } from 'vitest'
import {
  TEMPLATES,
  dueCount,
  isComplete,
  pace,
  progress,
  remainingCents,
  savedCents,
  slotAmount,
  slotDate,
  slots,
  suggestSlot,
  totalCents,
} from './challenges'
import type { Challenge } from './types'

function challenge(over: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c1',
    updatedAt: 1,
    deletedAt: null,
    name: '1-€-Challenge',
    kind: 'steigend',
    stepCents: 100,
    slots: 52,
    unit: 'woche',
    startDate: '2026-01-05',
    potId: null,
    filled: [],
    archived: false,
    ...over,
  }
}

describe('Beträge', () => {
  it('staffelt die klassische 52-Wochen-Challenge', () => {
    const c = challenge()
    expect(slotAmount(c, 0)).toBe(100) // Woche 1: 1 €
    expect(slotAmount(c, 51)).toBe(5200) // Woche 52: 52 €
    // Die bekannte Endsumme der 1-€-Challenge: 1.378 €.
    expect(totalCents(c)).toBe(137800)
  })

  it('rechnet die 2-€- und 5-€-Challenge im gleichen Verhältnis', () => {
    expect(totalCents(challenge({ stepCents: 200 }))).toBe(275600) // 2.756 €
    expect(totalCents(challenge({ stepCents: 500 }))).toBe(689000) // 6.890 €
  })

  it('hält bei gleichbleibender Challenge den Betrag', () => {
    const c = challenge({ kind: 'gleich', stepCents: 500 })
    expect(slotAmount(c, 0)).toBe(500)
    expect(slotAmount(c, 40)).toBe(500)
    expect(totalCents(c)).toBe(26000) // 52 × 5 € = 260 €
  })

  it('staffelt auch die freie Einteilung', () => {
    // „Frei“ heißt frei in der Reihenfolge, nicht im Betrag.
    const c = challenge({ kind: 'frei' })
    expect(slotAmount(c, 0)).toBe(100)
    expect(slotAmount(c, 51)).toBe(5200)
    expect(totalCents(c)).toBe(137800)
  })

  it('rechnet die 1-Cent-Challenge auf ganze Cent auf', () => {
    const c = challenge({ stepCents: 1, slots: 365, unit: 'tag' })
    expect(totalCents(c)).toBe(66795) // 667,95 €
    expect(Number.isInteger(totalCents(c))).toBe(true)
  })

  it('bleibt bei jeder Vorlage bei ganzen Cent', () => {
    for (const t of TEMPLATES) {
      const total = totalCents(t)
      expect(Number.isInteger(total), `${t.name} ergibt keinen ganzen Cent-Betrag`).toBe(true)
      expect(total).toBeGreaterThan(0)
    }
  })
})

describe('Fortschritt', () => {
  it('misst am Geld, nicht an der Zahl der Häkchen', () => {
    // Ein Häkchen auf dem 52-€-Feld ist mehr wert als eines auf dem 1-€-Feld.
    const klein = challenge({ filled: [0] })
    const gross = challenge({ filled: [51] })
    expect(savedCents(klein)).toBe(100)
    expect(savedCents(gross)).toBe(5200)
    expect(progress(gross)).toBeGreaterThan(progress(klein))
  })

  it('rechnet Gespartes, Rest und Prozent zusammen', () => {
    const c = challenge({ filled: [0, 1, 2] }) // 1 + 2 + 3 = 6 €
    expect(savedCents(c)).toBe(600)
    expect(remainingCents(c)).toBe(137200)
    expect(savedCents(c) + remainingCents(c)).toBe(totalCents(c))
  })

  it('meldet eine volle Challenge als fertig', () => {
    const c = challenge({ slots: 3, filled: [0, 1, 2] })
    expect(isComplete(c)).toBe(true)
    expect(progress(c)).toBe(100)
    expect(remainingCents(c)).toBe(0)
  })

  it('startet bei null', () => {
    expect(progress(challenge())).toBe(0)
    expect(savedCents(challenge())).toBe(0)
  })
})

describe('slotDate', () => {
  it('rechnet Wochen, Tage und Monate ab dem Start', () => {
    const woche = challenge({ startDate: '2026-01-05' })
    expect(slotDate(woche, 0)).toBe('2026-01-05')
    expect(slotDate(woche, 1)).toBe('2026-01-12')
    expect(slotDate(woche, 51)).toBe('2026-12-28')

    const tag = challenge({ unit: 'tag', startDate: '2026-01-01' })
    expect(slotDate(tag, 30)).toBe('2026-01-31')

    const monat = challenge({ unit: 'monat', startDate: '2026-01-15' })
    expect(slotDate(monat, 1)).toBe('2026-02-15')
    expect(slotDate(monat, 11)).toBe('2026-12-15')
  })

  it('rutscht auf den Monatsletzten, wenn der Starttag fehlt', () => {
    // Ein Start am 31. Januar hat im Februar keine Entsprechung.
    const c = challenge({ unit: 'monat', startDate: '2026-01-31' })
    expect(slotDate(c, 1)).toBe('2026-02-28')
    expect(slotDate(c, 3)).toBe('2026-04-30')
  })
})

describe('dueCount und pace', () => {
  it('zählt am Starttag ein fälliges Feld', () => {
    expect(dueCount(challenge(), '2026-01-05')).toBe(1)
  })

  it('zählt vor dem Start nichts', () => {
    expect(dueCount(challenge(), '2025-12-30')).toBe(0)
  })

  it('wächst mit der Zeit und bleibt am Ende stehen', () => {
    const c = challenge()
    expect(dueCount(c, '2026-01-11')).toBe(1) // noch in Woche 1
    expect(dueCount(c, '2026-01-12')).toBe(2) // Woche 2 beginnt
    expect(dueCount(c, '2030-01-01')).toBe(52) // nie mehr als es Felder gibt
  })

  it('meldet Rückstand und Plan', () => {
    const im_plan = pace(challenge({ filled: [0, 1] }), '2026-01-12')
    expect(im_plan.due).toBe(2)
    expect(im_plan.behind).toBe(0)
    expect(im_plan.onTrack).toBe(true)

    const hinterher = pace(challenge({ filled: [0] }), '2026-02-02')
    expect(hinterher.behind).toBeGreaterThan(0)
    expect(hinterher.onTrack).toBe(false)
  })

  it('zählt Vorsprung nicht als Rückstand', () => {
    expect(pace(challenge({ filled: [0, 1, 2, 3, 4] }), '2026-01-05').behind).toBe(0)
  })
})

describe('suggestSlot', () => {
  it('geht bei fester Reihenfolge das erste offene Feld an', () => {
    expect(suggestSlot(challenge({ filled: [0, 1] }))).toBe(2)
    expect(suggestSlot(challenge({ kind: 'gleich', filled: [] }))).toBe(0)
  })

  it('gibt bei voller Challenge nichts zurück', () => {
    expect(suggestSlot(challenge({ slots: 2, filled: [0, 1] }))).toBeNull()
  })

  it('räumt bei freier Einteilung mit Budget die teuersten Felder zuerst weg', () => {
    // 20 € übrig: Das 20-€-Feld ist Feld 19 (0-basiert).
    const c = challenge({ kind: 'frei' })
    expect(suggestSlot(c, 2000)).toBe(19)
    // Genau zwischen zwei Feldern: das größere, das noch passt.
    expect(suggestSlot(c, 2050)).toBe(19)
  })

  it('schlägt bei knappem Budget das billigste offene Feld vor', () => {
    // Weniger als 1 € übrig – irgendein Angebot soll trotzdem kommen.
    const c = challenge({ kind: 'frei', filled: [0] })
    expect(suggestSlot(c, 50)).toBe(1)
  })

  it('bietet bei freier Einteilung ohne Budget den kleinen Einstieg', () => {
    expect(suggestSlot(challenge({ kind: 'frei', filled: [0, 1] }))).toBe(2)
  })
})

describe('slots', () => {
  it('baut das Raster mit Betrag, Zustand und Termin', () => {
    const list = slots(challenge({ slots: 3, filled: [1] }), '2026-01-05')
    expect(list).toHaveLength(3)
    expect(list[0]).toMatchObject({ index: 0, cents: 100, filled: false, date: '2026-01-05' })
    expect(list[1]).toMatchObject({ index: 1, cents: 200, filled: true })
    expect(list[2]!.cents).toBe(300)
  })

  it('kennzeichnet überfällige Felder', () => {
    const list = slots(challenge({ slots: 5 }), '2026-01-26') // Woche 4 läuft
    expect(list[0]!.overdue).toBe(true)
    expect(list[3]!.overdue).toBe(true)
    expect(list[4]!.overdue).toBe(false) // noch nicht dran
  })

  it('kennt bei freier Einteilung keine Überfälligkeit', () => {
    // Dort ist die Reihenfolge ja gerade freigestellt – nichts ist „zu spät“.
    const list = slots(challenge({ kind: 'frei', slots: 5 }), '2026-06-01')
    expect(list.every((s) => !s.overdue)).toBe(true)
  })
})

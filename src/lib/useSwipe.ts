import { useRef, useState, type TouchEvent } from 'react'

/**
 * Nach links wischen zum Löschen.
 *
 * Auf dem Telefon ist das der kürzeste Weg: kein Öffnen, kein Menü. Zwei
 * Dinge müssen dabei stimmen, sonst wird die Liste unbenutzbar:
 *
 * 1. **Senkrecht scrollen hat Vorrang.** Die Richtung wird einmal zu Beginn
 *    entschieden; wer erkennbar nach oben wischt, zieht nichts zur Seite.
 * 2. **Es braucht eine Absicht.** Erst ab einer klaren Strecke löst es aus –
 *    ein Wackeln beim Antippen darf nichts löschen.
 */

/** Ab hier gilt die Geste als waagerecht. */
const RICHTUNG_SCHWELLE = 10
/** Ab hier löst das Loslassen aus. */
const AUSLOESE_SCHWELLE = 80
/** Weiter lässt sich nicht ziehen. */
const MAX = 96

export function useSwipeToDelete(onDelete: () => void) {
  const [offset, setOffset] = useState(0)
  const start = useRef<{ x: number; y: number } | null>(null)
  // null = noch unentschieden, sobald klar: waagerecht oder senkrecht.
  const axis = useRef<'x' | 'y' | null>(null)

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0]
    if (!touch) return
    start.current = { x: touch.clientX, y: touch.clientY }
    axis.current = null
  }

  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0]
    if (!touch || !start.current) return

    const dx = touch.clientX - start.current.x
    const dy = touch.clientY - start.current.y

    if (axis.current === null) {
      if (Math.abs(dx) < RICHTUNG_SCHWELLE && Math.abs(dy) < RICHTUNG_SCHWELLE) return
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (axis.current === 'y') return

    // Nur nach links; nach rechts gibt es nichts freizulegen.
    setOffset(Math.max(-MAX, Math.min(0, dx)))
  }

  const onTouchEnd = () => {
    if (axis.current === 'x' && offset <= -AUSLOESE_SCHWELLE) onDelete()
    setOffset(0)
    start.current = null
    axis.current = null
  }

  return {
    offset,
    armed: offset <= -AUSLOESE_SCHWELLE,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd },
  }
}

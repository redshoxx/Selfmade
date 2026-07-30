import { useEffect } from 'react'

/**
 * „Gelöscht · Rückgängig“.
 *
 * Auf dem Telefon trifft man beim Gehen auch mal daneben. Ohne Weg zurück ist
 * ein Fehlgriff endgültig – und weil Löschen hier nur einen Grabstein setzt
 * (`deletedAt`), kostet die Rücknahme nichts als ein zurückgesetztes Feld.
 *
 * Bewusst kein Nachfragen vor dem Löschen: Eine Rückfrage bremst jedes Mal,
 * ein Rückgängig nur im Fehlerfall.
 */

export interface UndoState {
  label: string
  onUndo: () => void
  /** Zählt hoch, damit auch zweimal dieselbe Meldung neu erscheint. */
  key: number
}

const DAUER = 7000

export function UndoBar({ state, onDismiss }: { state: UndoState | null; onDismiss: () => void }) {
  const key = state?.key

  useEffect(() => {
    if (key === undefined) return
    const timer = window.setTimeout(onDismiss, DAUER)
    return () => window.clearTimeout(timer)
  }, [key, onDismiss])

  if (!state) return null

  return (
    <div className="undo" role="status">
      <span className="undo-text">{state.label}</span>
      <button
        type="button"
        className="undo-action"
        onClick={() => {
          state.onUndo()
          onDismiss()
        }}
      >
        Rückgängig
      </button>
    </div>
  )
}

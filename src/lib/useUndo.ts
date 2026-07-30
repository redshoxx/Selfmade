import { useCallback, useRef, useState } from 'react'
import type { UndoState } from '../components/Undo'
import type { Action, UndoableList } from './store'

/**
 * Löschen mit Weg zurück.
 *
 * Bündelt, was sonst in jeder Ansicht doppelt stünde: löschen, Streifen
 * zeigen, auf Wunsch zurückholen. Mehrere Löschungen kurz hintereinander
 * sammeln sich zu *einer* Meldung – sonst überschriebe jede neue die
 * vorherige, und die erste ließe sich nicht mehr zurücknehmen.
 */
export function useUndo(dispatch: (action: Action) => void) {
  const [state, setState] = useState<UndoState | null>(null)
  const counter = useRef(0)
  // Was seit dem letzten Streifen gelöscht wurde, je Liste.
  const pending = useRef<{ list: UndoableList; ids: string[] } | null>(null)

  const dismiss = useCallback(() => {
    pending.current = null
    setState(null)
  }, [])

  const remove = useCallback(
    (list: UndoableList, id: string, action: Action, label = 'Gelöscht') => {
      dispatch(action)

      // Sammeln, solange die Meldung derselben Liste gilt.
      const batch =
        pending.current && pending.current.list === list
          ? { list, ids: [...pending.current.ids, id] }
          : { list, ids: [id] }
      pending.current = batch

      const count = batch.ids.length
      counter.current += 1
      setState({
        key: counter.current,
        label: count > 1 ? `${count} gelöscht` : label,
        onUndo: () => {
          dispatch({ type: 'undo/restore', list: batch.list, ids: batch.ids })
          pending.current = null
        },
      })
    },
    [dispatch],
  )

  return { undo: state, dismiss, remove }
}

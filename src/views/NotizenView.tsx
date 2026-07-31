import { useMemo, useState } from 'react'
import { Empty } from '../components/Bits'
import { IconPlus, IconTrash } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { UndoBar } from '../components/Undo'
import { live } from '../lib/store'
import { useApp } from '../lib/useApp'
import { useUndo } from '../lib/useUndo'
import type { Note } from '../lib/types'

/**
 * Der Notizzettel des Haushalts.
 *
 * Für alles, was keine Einkaufsliste ist: das Rezept vom Wochenende, die Maße
 * fürs Regal, „Nachbarn Bescheid sagen“. Geteilt wie die Liste – wer im
 * Haushalt ist, sieht und ändert dasselbe.
 *
 * Sitzt bewusst als Umschalter im Einkauf-Bereich statt als eigener Reiter:
 * Fünf sind auf einem schmalen Telefon bereits die Obergrenze, ein sechster
 * macht alle kleiner.
 */
export function NotizenView({ onBack }: { onBack: () => void }) {
  const { state, dispatch } = useApp()
  const [open, setOpen] = useState<Note | null>(null)
  const [creating, setCreating] = useState(false)
  const { undo, dismiss, remove } = useUndo(dispatch)

  const notes = useMemo(() => {
    // Angeheftetes oben, darunter das zuletzt Geänderte.
    return live(state.notes).sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
  }, [state.notes])

  return (
    <>
      <div className="scroll">
        <div className="head">
          <h1>Notizen</h1>
          <button type="button" className="btn btn-ghost" onClick={() => setCreating(true)}>
            <IconPlus size={18} />
            Neu
          </button>
        </div>

        <div className="segmented" style={{ marginBottom: 14 }}>
          <button type="button" aria-pressed={false} onClick={onBack}>
            Liste
          </button>
          <button type="button" aria-pressed>
            Notizen
          </button>
        </div>

        {notes.length === 0 ? (
          <Empty
            emoji="📝"
            title="Noch keine Notiz"
            text="Für alles, was keine Einkaufsliste ist – Rezepte, Maße, Erinnerungen."
          />
        ) : (
          <div className="card">
            {notes.map((note) => (
              <button key={note.id} type="button" className="note-card" onClick={() => setOpen(note)}>
                <span className="note-title">
                  {note.pinned && <span aria-label="angeheftet">📌</span>}
                  {note.title || 'Ohne Titel'}
                </span>
                {note.body && <span className="note-body">{note.body}</span>}
              </button>
            ))}
          </div>
        )}

        <div className="btn-row">
          <button type="button" className="btn btn-primary btn-wide" onClick={() => setCreating(true)}>
            <IconPlus size={18} />
            Notiz anlegen
          </button>
        </div>
      </div>

      <UndoBar state={undo} onDismiss={dismiss} />

      {creating && <NoteSheet onClose={() => setCreating(false)} />}
      {open && (
        <NoteSheet
          note={open}
          onClose={() => setOpen(null)}
          onDelete={() => {
            remove('notes', open.id, { type: 'note/remove', id: open.id }, 'Notiz gelöscht')
            setOpen(null)
          }}
        />
      )}
    </>
  )
}

function NoteSheet({
  note,
  onClose,
  onDelete,
}: {
  note?: Note
  onClose: () => void
  onDelete?: () => void
}) {
  const { state, dispatch } = useApp()
  const current = note ? live(state.notes).find((n) => n.id === note.id) ?? note : undefined

  const [title, setTitle] = useState(current?.title ?? '')
  const [body, setBody] = useState(current?.body ?? '')
  const [pinned, setPinned] = useState(current?.pinned ?? false)

  // Eine Notiz ganz ohne Inhalt wäre nur eine leere Zeile in der Liste.
  const canSave = title.trim() !== '' || body.trim() !== ''

  const save = () => {
    if (!canSave) return
    const payload = { title: title.trim(), body: body.trim(), pinned }
    if (current) dispatch({ type: 'note/update', id: current.id, patch: payload })
    else dispatch({ type: 'note/add', note: payload })
    onClose()
  }

  return (
    <Sheet
      title={current ? 'Notiz' : 'Neue Notiz'}
      onClose={onClose}
      action={
        onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Löschen"
            style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'var(--bad)' }}
          >
            <IconTrash />
          </button>
        )
      }
    >
      <input
        className="input"
        value={title}
        autoFocus={!current}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Titel"
        aria-label="Titel"
        style={{ fontWeight: 600, marginBottom: 10 }}
        autoCapitalize="sentences"
      />

      <textarea
        className="textarea"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Schreib los …"
        aria-label="Inhalt"
      />

      <button
        type="button"
        className={`chip${pinned ? ' chip-on' : ''}`}
        onClick={() => setPinned(!pinned)}
        aria-pressed={pinned}
        style={{ marginTop: 12 }}
      >
        📌 Oben anheften
      </button>

      <div className="btn-row">
        <button type="button" className="btn btn-primary btn-wide" onClick={save} disabled={!canSave}>
          Speichern
        </button>
      </div>
    </Sheet>
  )
}

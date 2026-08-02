import { useMemo, useRef, useState } from 'react'
import { Empty } from '../components/Bits'
import { IconCheck, IconClose, IconPlus, IconTrash } from '../components/Icons'
import { Kopf, KopfKnopf } from '../components/Kopf'
import { Sheet } from '../components/Sheet'
import { UndoBar } from '../components/Undo'
import { newId } from '../lib/id'
import { tick } from '../lib/platform'
import { live } from '../lib/store'
import { useApp } from '../lib/useApp'
import { useUndo } from '../lib/useUndo'
import { NOTE_COLORS, type Note, type NoteCheck, type NoteColor } from '../lib/types'

/**
 * Der Notizzettel des Haushalts.
 *
 * Für alles, was keine Einkaufsliste ist: das Rezept vom Wochenende, die Maße
 * fürs Regal, die Packliste für den Urlaub. Geteilt wie die Liste – wer
 * freigeschaltet ist, sieht und ändert dasselbe.
 *
 * Bis eben lag das als Umschalter *innerhalb* des Einkaufs, samt einer
 * Segmentleiste, die jeden Besuch der Einkaufsliste eine Zeile kostete – auch
 * bei dem, der nie eine Notiz schreibt. Jetzt ist es ein eigener Ort.
 */

/** Ab so vielen Notizen lohnt ein Suchfeld; davor kostet es nur Platz. */
const SUCHE_AB = 8

const FARBNAMEN: Record<NoteColor, string> = {
  keine: 'ohne Farbe',
  gelb: 'gelb',
  gruen: 'grün',
  blau: 'blau',
  rot: 'rot',
  lila: 'lila',
}

export function NotizenView() {
  const { state, dispatch } = useApp()
  const [open, setOpen] = useState<Note | null>(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const { undo, dismiss, remove } = useUndo(dispatch)

  const alle = useMemo(() => {
    // Angeheftetes oben, darunter das zuletzt Geänderte.
    return live(state.notes).sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
  }, [state.notes])

  const notes = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return alle
    // Auch die Häkchenpunkte durchsuchen: In einer Packliste steht das
    // Gesuchte praktisch nie im Titel.
    return alle.filter(
      (n) =>
        n.title.toLowerCase().includes(needle) ||
        n.body.toLowerCase().includes(needle) ||
        n.checks.some((c) => c.text.toLowerCase().includes(needle)),
    )
  }, [alle, query])

  return (
    <>
      <Kopf
        titel="Notizen"
        aktionen={
          <KopfKnopf label="Notiz anlegen" onClick={() => setCreating(true)} ton="akzent">
            <IconPlus size={21} />
          </KopfKnopf>
        }
      />

      <div className="scroll">
        {alle.length >= SUCHE_AB && (
          <div className="search">
            <input
              className="input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="In Notizen suchen"
              aria-label="In Notizen suchen"
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setQuery('')}
                aria-label="Suche leeren"
              >
                <IconClose size={18} />
              </button>
            )}
          </div>
        )}

        {alle.length === 0 ? (
          <Empty
            emoji="📝"
            title="Noch keine Notiz"
            text="Für alles, was keine Einkaufsliste ist – Rezepte, Maße, Packlisten zum Abhaken."
          />
        ) : notes.length === 0 ? (
          <Empty emoji="🔍" title="Nichts gefunden" text={`„${query}“ steht in keiner Notiz.`} />
        ) : (
          <div className="card">
            {notes.map((note) => (
              <NotizKarte key={note.id} note={note} onClick={() => setOpen(note)} />
            ))}
          </div>
        )}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary btn-wide"
            onClick={() => setCreating(true)}
          >
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

function NotizKarte({ note, onClick }: { note: Note; onClick: () => void }) {
  const offen = note.checks.filter((c) => !c.done).length

  return (
    <button type="button" className="note-card" data-farbe={note.color} onClick={onClick}>
      <span className="note-title">
        {note.pinned && <span aria-label="angeheftet">📌</span>}
        {note.title || 'Ohne Titel'}
      </span>
      {note.body && <span className="note-body">{note.body}</span>}
      {note.checks.length > 0 && (
        <span className="note-fortschritt">
          <IconCheck size={13} />
          {offen === 0
            ? `alle ${note.checks.length} erledigt`
            : `${note.checks.length - offen} von ${note.checks.length}`}
        </span>
      )}
    </button>
  )
}

/* --- Anlegen und Bearbeiten ------------------------------------------------ */

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
  // Aus dem Zustand lesen, nicht aus der Übergabe: Hakt die andere Person
  // etwas ab, während das Blatt offen ist, steht hier der neue Stand.
  const current = note ? (live(state.notes).find((n) => n.id === note.id) ?? note) : undefined

  const [title, setTitle] = useState(current?.title ?? '')
  const [body, setBody] = useState(current?.body ?? '')
  const [pinned, setPinned] = useState(current?.pinned ?? false)
  const [color, setColor] = useState<NoteColor>(current?.color ?? 'keine')
  const [entwurfChecks, setEntwurfChecks] = useState<NoteCheck[]>([])
  const [neuerPunkt, setNeuerPunkt] = useState('')
  const punktFeld = useRef<HTMLInputElement>(null)

  /*
   * Zwei Betriebsarten, und der Unterschied ist wichtig.
   *
   * Eine *bestehende* Notiz wird sofort geschrieben – so, wie ein Eintrag auf
   * der Einkaufsliste sofort geschrieben wird. Eine geteilte Packliste, bei
   * der man nach jedem Häkchen „Speichern“ drücken muss, hakt niemand ab; und
   * schriebe das Blatt beim Schließen die ganze Liste zurück, überschriebe es
   * die Häkchen, die der andere in der Zwischenzeit gesetzt hat.
   *
   * Eine *neue* Notiz gibt es noch nicht, also gibt es auch nichts zu
   * schreiben. Ihre Punkte liegen bis zum Anlegen hier.
   */
  const checks = current ? current.checks : entwurfChecks

  const setzeChecks = (naechste: NoteCheck[]) => {
    if (current)
      dispatch({
        type: 'note/update',
        id: current.id,
        patch: { checks: naechste },
      })
    else setEntwurfChecks(naechste)
  }

  const punktHinzu = (text: string) => {
    const sauber = text.trim()
    if (!sauber) return
    setzeChecks([...checks, { id: newId(), text: sauber, done: false }])
    setNeuerPunkt('')
    // Fokus bleibt im Feld: Wer eine Liste tippt, tippt selten nur eine Zeile.
    punktFeld.current?.focus()
  }

  const punktUm = (id: string) => {
    tick(state.settings.haptics)
    if (current) dispatch({ type: 'note/toggleCheck', id: current.id, checkId: id })
    else setEntwurfChecks((b) => b.map((c) => (c.id === id ? { ...c, done: !c.done } : c)))
  }

  // Eine Notiz ganz ohne Inhalt wäre nur eine leere Zeile in der Liste – ein
  // einzelnes Häkchen genügt aber, eine Packliste braucht keinen Titel.
  const canSave = title.trim() !== '' || body.trim() !== '' || checks.length > 0

  /** Bei einer bestehenden Notiz sofort, sonst erst beim Anlegen. */
  const merke = (patch: Partial<Note>) => {
    if (current) dispatch({ type: 'note/update', id: current.id, patch })
  }

  const anlegen = () => {
    if (!canSave) return
    dispatch({
      type: 'note/add',
      note: { title: title.trim(), body: body.trim(), pinned, color, checks },
    })
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
            style={{
              width: 40,
              height: 40,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--bad)',
            }}
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
        onBlur={() => merke({ title: title.trim() })}
        placeholder="Titel"
        aria-label="Titel"
        style={{ fontWeight: 600, marginBottom: 10 }}
        autoCapitalize="sentences"
      />

      <textarea
        className="textarea"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onBlur={() => merke({ body: body.trim() })}
        placeholder="Schreib los …"
        aria-label="Inhalt"
      />

      <h2 className="section">Zum Abhaken</h2>
      {checks.length > 0 && (
        <div className="card pad" style={{ paddingTop: 4, paddingBottom: 4 }}>
          {checks.map((punkt) => (
            <div key={punkt.id} className="spread" style={{ gap: 8 }}>
              <button
                type="button"
                className={`check-zeile${punkt.done ? ' check-zeile-erledigt' : ''}`}
                onClick={() => punktUm(punkt.id)}
                role="checkbox"
                aria-checked={punkt.done}
              >
                <span className={`check-klein${punkt.done ? ' check-klein-on' : ''}`}>
                  <IconCheck size={13} />
                </span>
                <span className="check-zeile-text">{punkt.text}</span>
              </button>
              <button
                type="button"
                onClick={() => setzeChecks(checks.filter((c) => c.id !== punkt.id))}
                aria-label={`„${punkt.text}“ entfernen`}
                style={{
                  width: 34,
                  height: 34,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--text-3)',
                }}
              >
                <IconClose size={17} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: checks.length > 0 ? 10 : 0,
        }}
      >
        <input
          ref={punktFeld}
          className="input"
          value={neuerPunkt}
          onChange={(event) => setNeuerPunkt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              punktHinzu(neuerPunkt)
            }
          }}
          placeholder="Punkt hinzufügen"
          aria-label="Punkt hinzufügen"
          enterKeyHint="done"
          autoCapitalize="sentences"
        />
        <button
          type="button"
          className="quick-add"
          onClick={() => punktHinzu(neuerPunkt)}
          disabled={!neuerPunkt.trim()}
          aria-label="Punkt hinzufügen"
        >
          <IconPlus size={22} />
        </button>
      </div>

      <h2 className="section">Farbe</h2>
      <div className="farben">
        {NOTE_COLORS.map((farbe) => (
          <button
            key={farbe}
            type="button"
            className={`farbe${color === farbe ? ' farbe-on' : ''}`}
            data-farbe={farbe}
            onClick={() => {
              setColor(farbe)
              merke({ color: farbe })
            }}
            aria-pressed={color === farbe}
            aria-label={FARBNAMEN[farbe]}
          >
            <span className="farbe-punkt" />
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`chip${pinned ? ' chip-on' : ''}`}
        onClick={() => {
          setPinned(!pinned)
          merke({ pinned: !pinned })
        }}
        aria-pressed={pinned}
        style={{ marginTop: 16 }}
      >
        📌 Oben anheften
      </button>

      {/* Bei einer bestehenden Notiz steht schon alles geschrieben – ein
          „Speichern“ daneben ließe zweifeln, ob es das auch tut. */}
      <div className="btn-row">
        {current ? (
          <button type="button" className="btn btn-wide" onClick={onClose}>
            Fertig
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-wide"
            onClick={anlegen}
            disabled={!canSave}
          >
            Notiz anlegen
          </button>
        )}
      </div>
    </Sheet>
  )
}

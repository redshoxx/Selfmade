import { useEffect, useRef, type ReactNode } from 'react'
import { IconClose } from './Icons'

/**
 * Ein von unten aufsteigendes Blatt.
 *
 * Alles Eingeben passiert hier. Der Vorteil gegenüber einer eigenen Seite: Der
 * Zusammenhang bleibt sichtbar, und der Weg zurück ist eine Geste statt einer
 * Navigation.
 */

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** Zusätzliche Schaltfläche oben rechts, etwa zum Löschen. */
  action?: ReactNode
}

export function Sheet({ title, onClose, children, action }: Props) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    // Der Hintergrund darf nicht mitscrollen, während das Blatt offen ist –
    // sonst verliert man beim Schließen seine Position in der Liste.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  useEffect(() => {
    // Den Fokus ins Blatt holen, damit Tastatur und Vorlesehilfe hier landen
    // und nicht weiter durch die Seite dahinter wandern.
    panel.current?.focus()
  }, [])

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panel}
        tabIndex={-1}
      >
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {action}
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'var(--text-2)' }}
            >
              <IconClose />
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  )
}

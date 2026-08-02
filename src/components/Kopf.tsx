import type { ReactNode } from 'react'

/**
 * Der Kopf jeder Ansicht.
 *
 * Vorher trug jede Ansicht ihren Titel selbst im Scrollbereich, und das
 * Zahnrad schwebte fest über allem – mit einem `padding-right: 42px` in der
 * Titelzeile als Ausgleich. Auf Vorrat und Notizen reichte das nicht: Deren
 * Schaltfläche rechts oben lag um 12 Punkte unter dem Zahnrad, auf einem 390
 * Punkte breiten iPhone messbar und mit dem Daumen spürbar.
 *
 * Jetzt gibt es genau eine Zeile, in der oben rechts etwas stehen darf, und
 * die weiß, was sie trägt. Der Nebeneffekt ist der eigentliche Gewinn: Jeder
 * Bildschirm hat denselben Bau – Kopf, Inhalt, Leiste –, und man findet sich
 * zurecht, ohne hinzusehen.
 */
export function Kopf({
  titel,
  beiwerk,
  aktionen,
}: {
  titel: string
  /** Kurzer Zusatz hinter dem Titel, etwa „3 offen“ oder der Monat. */
  beiwerk?: ReactNode
  /** Höchstens zwei Schaltflächen – mehr trifft man nebeneinander nicht. */
  aktionen?: ReactNode
}) {
  return (
    <header className="kopf">
      <h1 className="kopf-titel">{titel}</h1>
      {beiwerk && <div className="kopf-beiwerk">{beiwerk}</div>}
      {aktionen && <div className="kopf-aktionen">{aktionen}</div>}
    </header>
  )
}

/**
 * Runde Schaltfläche für den Kopf.
 *
 * 40 Punkte sichtbar, 44 Punkte Trefferfläche – die Untergrenze, unter der man
 * im Gehen danebentippt.
 */
export function KopfKnopf({
  label,
  onClick,
  children,
  ton,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  ton?: 'akzent'
}) {
  return (
    <button
      type="button"
      className={`kopf-knopf${ton === 'akzent' ? ' kopf-knopf-akzent' : ''}`}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </button>
  )
}

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { formatPlain, parseAmount } from '../lib/money'

/** Kleine, oft gebrauchte Bausteine. */

export function Bar({ percent, tone }: { percent: number; tone?: 'good' | 'warn' | 'bad' }) {
  const width = Math.min(100, Math.max(0, percent))
  return (
    <div
      className="bar"
      role="progressbar"
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`bar-fill${tone ? ` ${tone}` : ''}`} style={{ width: `${width}%` }} />
    </div>
  )
}

export function Empty({ emoji, title, text }: { emoji: string; title: string; text?: string }) {
  return (
    <div className="empty">
      <div className="empty-emoji" aria-hidden="true">
        {emoji}
      </div>
      <div className="empty-title">{title}</div>
      {text && <div className="empty-text">{text}</div>}
    </div>
  )
}

export function Field({
  label,
  children,
  error,
}: {
  label: string
  children: ReactNode
  error?: string | null
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}

/**
 * Eingabefeld für Beträge.
 *
 * Hält den Text so, wie er getippt wurde, und meldet nach außen nur Cent. Wer
 * „12,“ tippt, soll das Komma stehen sehen und nicht dabei zusehen, wie das
 * Feld die Eingabe hinter dem Cursor umschreibt.
 *
 * `inputMode="decimal"` bringt auf iPhone und Android das Ziffernfeld mit
 * Komma – ohne das tippt man Beträge auf der Buchstabentastatur.
 */
export function AmountField({
  cents,
  onChange,
  autoFocus,
  label = 'Betrag',
}: {
  cents: number | null
  onChange: (cents: number | null) => void
  autoFocus?: boolean
  label?: string
}) {
  const [text, setText] = useState(() => (cents === null ? '' : formatPlain(cents)))
  const input = useRef<HTMLInputElement>(null)
  const touched = useRef(false)

  useEffect(() => {
    // Von außen gesetzte Beträge übernehmen, solange niemand tippt.
    if (!touched.current && cents !== null) setText(formatPlain(cents))
  }, [cents])

  useEffect(() => {
    if (!autoFocus) return
    // Kurz warten: Erscheint das Blatt noch, ignoriert iOS den Fokus und die
    // Tastatur bleibt unten.
    const timer = window.setTimeout(() => input.current?.focus(), 120)
    return () => window.clearTimeout(timer)
  }, [autoFocus])

  const invalid = text.trim() !== '' && parseAmount(text) === null

  return (
    <Field label={label} error={invalid ? 'Bitte einen Betrag wie 12,50 eingeben.' : null}>
      <input
        ref={input}
        className="input input-amount"
        inputMode="decimal"
        enterKeyHint="done"
        placeholder="0,00"
        value={text}
        onChange={(event) => {
          touched.current = true
          const next = event.target.value
          setText(next)
          onChange(next.trim() === '' ? null : parseAmount(next))
        }}
        onBlur={() => {
          // Beim Verlassen sauber ausschreiben: aus „12,5“ wird „12,50“.
          const parsed = parseAmount(text)
          if (parsed !== null) setText(formatPlain(parsed))
          touched.current = false
        }}
        aria-invalid={invalid}
      />
    </Field>
  )
}

/**
 * Zeile, die sich antippen lässt und rechts einen Wert zeigt.
 * Als `<button>`, damit sie auch mit Tastatur und Vorlesehilfe erreichbar ist.
 */
export function TapRow({
  title,
  sub,
  value,
  onClick,
  leading,
  trailing,
  done,
}: {
  title: string
  sub?: ReactNode
  value?: ReactNode
  onClick?: () => void
  leading?: ReactNode
  trailing?: ReactNode
  done?: boolean
}) {
  const content = (
    <>
      {leading}
      <span className="row-main">
        <span className="row-title">{title}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      {value && <span className="row-value money">{value}</span>}
      {trailing}
    </>
  )

  const className = `row${done ? ' row-done' : ''}`
  if (!onClick) return <div className={className}>{content}</div>
  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  )
}

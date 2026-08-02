/**
 * Symbole als Strichzeichnungen.
 *
 * Selbst gezeichnet statt aus einer Bibliothek: Es sind ein Dutzend Stück, und
 * eine Symbolbibliothek wiegt mehr als die halbe App.
 *
 * Die fünf Symbole der Reiterleiste können zusätzlich *gefüllt*. Das ist keine
 * Spielerei: In der Leiste unterschied bisher allein die Farbe den aktiven
 * Reiter, und Farbe allein trägt zu wenig – bei hellem Sonnenlicht, bei
 * eingeschränktem Farbsehen, im Vorbeigehen. Gefüllt gegen Umriss ist ein
 * Unterschied in der Form, und iOS macht es mit seinen Symbolen genauso.
 */

interface Props {
  size?: number
  /** Nur die fünf Reiter-Symbole werten das aus. */
  filled?: boolean
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

/** Gefüllt heißt: Fläche in der Textfarbe, kein zusätzlicher Umriss. */
const voll = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  stroke: 'none',
  'aria-hidden': true,
})

export function IconHome({ size = 22, filled }: Props) {
  if (filled) {
    return (
      <svg {...voll(size)}>
        <path d="M11.36 2.65a1 1 0 0 1 1.28 0l8.5 7.1A1 1 0 0 1 21.5 11H20v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-9H2.5a1 1 0 0 1-.64-1.77Z" />
      </svg>
    )
  }
  return (
    <svg {...base(size)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  )
}

export function IconWallet({ size = 22, filled }: Props) {
  if (filled) {
    return (
      <svg {...voll(size)}>
        <path d="M6 5h12a3 3 0 0 1 3 3v1H3V8a3 3 0 0 1 3-3Zm-3 6h18v5a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Zm14 4.7a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z" />
      </svg>
    )
  }
  return (
    <svg {...base(size)}>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18" />
      <circle cx="17" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconTarget({ size = 22 }: Props) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconCart({ size = 22, filled }: Props) {
  if (filled) {
    return (
      <svg {...voll(size)}>
        <path d="M1.6 3.4a1 1 0 0 1 1-1h2.2a1 1 0 0 1 .98.8l.34 1.7h14.4a1 1 0 0 1 .96 1.26l-1.9 7a1 1 0 0 1-.96.74H8.1l.3 1.5h9.8a1 1 0 1 1 0 2H7.6a1 1 0 0 1-.98-.8L3.98 4.4H2.6a1 1 0 0 1-1-1Z" />
        <circle cx="9" cy="20" r="1.7" />
        <circle cx="17.5" cy="20" r="1.7" />
      </svg>
    )
  }
  return (
    <svg {...base(size)}>
      <path d="M2.5 3.5h2.2l2.2 11h10.4" />
      <path d="M6.4 6.5H21l-1.6 6.2H7.6" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17.5" cy="19" r="1.5" />
    </svg>
  )
}

export function IconFridge({ size = 22, filled }: Props) {
  if (filled) {
    return (
      <svg {...voll(size)}>
        <path d="M8 2.5h8a3 3 0 0 1 3 3V9H5V5.5a3 3 0 0 1 3-3Zm-1 3.3v2h1.6v-2Zm-2 5.2h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Zm2 1.8v2.6h1.6V12.8Z" />
      </svg>
    )
  }
  return (
    <svg {...base(size)}>
      <rect x="5" y="2.5" width="14" height="19" rx="3" />
      <path d="M5 10h14" />
      <path d="M8.5 6v1.8M8.5 13v2.4" />
    </svg>
  )
}

export function IconNote({ size = 22, filled }: Props) {
  if (filled) {
    return (
      <svg {...voll(size)}>
        <path d="M6 2.5h12a2.5 2.5 0 0 1 2.5 2.5v14a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 19V5A2.5 2.5 0 0 1 6 2.5Zm1.6 5.3a.9.9 0 0 0 0 1.8h8.8a.9.9 0 0 0 0-1.8Zm0 4a.9.9 0 0 0 0 1.8h8.8a.9.9 0 0 0 0-1.8Zm0 4a.9.9 0 0 0 0 1.8h5a.9.9 0 0 0 0-1.8Z" />
      </svg>
    )
  }
  return (
    <svg {...base(size)}>
      <rect x="4" y="2.8" width="16" height="18.4" rx="3" />
      <path d="M8 8.5h8M8 12.5h8M8 16.5h5" />
    </svg>
  )
}

/** Vorlagen: ein Blatt mit Häkchen davor. */
export function IconTemplate({ size = 20 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5Z" />
      <path d="M7 9.5l1.5 1.5L11 8.5M14 10h4M7 15.5l1.5 1.5L11 14.5M14 16h4" />
    </svg>
  )
}

export function IconPlus({ size = 22 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconCheck({ size = 16 }: Props) {
  return (
    <svg {...base(size)} strokeWidth={2.6}>
      <path d="M4.5 12.5l4.5 4.5L19.5 6.5" />
    </svg>
  )
}

export function IconClose({ size = 22 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function IconChevron({ size = 20 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

export function IconGear({ size = 22 }: Props) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </svg>
  )
}

export function IconTrash({ size = 20 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M4 6.5h16M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13" />
    </svg>
  )
}

export function IconUsers({ size = 20 }: Props) {
  return (
    <svg {...base(size)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 5.6a3.2 3.2 0 0 1 0 4.9M17.5 14.8c2 .6 3.2 2.4 3.2 4.7" />
    </svg>
  )
}

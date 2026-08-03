/**
 * Symbole als Strichzeichnungen.
 *
 * Selbst gezeichnet statt aus einer Bibliothek: Es sind ein Dutzend Stück, und
 * eine Symbolbibliothek wiegt mehr als die halbe App.
 *
 * Die fünf Formen der Reiterleiste stammen aus dem Entwurf. Sie sind dort
 * durchweg Umrisse – auch der aktive Reiter. Das Signal trägt die Pille hinter
 * dem Symbol, nicht eine Füllung: ein Unterschied in der Fläche, den man auch
 * ohne Farbe sieht. Der aktive Reiter zieht seinen Strich nur etwas kräftiger.
 */

interface Props {
  size?: number
  /** Etwas kräftiger gezeichnet – für den aktiven Reiter. */
  stark?: boolean
}

const base = (size: number, stark = false) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: stark ? 2 : 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export function IconHome({ size = 22, stark }: Props) {
  return (
    <svg {...base(size, stark)}>
      <path d="M4 10.3 12 4l8 6.3V19a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19Z" />
      <path d="M9.6 20.6v-6.2h4.8v6.2" />
    </svg>
  )
}

export function IconWallet({ size = 22, stark }: Props) {
  return (
    <svg {...base(size, stark)}>
      <path d="M3.5 8.4A2.4 2.4 0 0 1 5.9 6h11.7a2.4 2.4 0 0 1 2.4 2.4v7.2a2.4 2.4 0 0 1-2.4 2.4H5.9a2.4 2.4 0 0 1-2.4-2.4Z" />
      <path d="M16.2 11.4h4.3v3.2h-4.3a1.6 1.6 0 0 1 0-3.2Z" />
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

export function IconCart({ size = 22, stark }: Props) {
  return (
    <svg {...base(size, stark)}>
      <path d="M3 4h2.2l2.4 10.4h9.6" />
      <path d="M6.6 7.2h13.6l-1.5 5.6H7.9" />
      <circle cx="9.2" cy="18.6" r="1.5" />
      <circle cx="16.8" cy="18.6" r="1.5" />
    </svg>
  )
}

export function IconFridge({ size = 22, stark }: Props) {
  return (
    <svg {...base(size, stark)}>
      <rect x="5.2" y="2.8" width="13.6" height="18.4" rx="3.4" />
      <path d="M5.2 10.2h13.6" />
      <path d="M8.6 6.4v1.6M8.6 13v2.2" />
    </svg>
  )
}

export function IconNote({ size = 22, stark }: Props) {
  return (
    <svg {...base(size, stark)}>
      <rect x="4.2" y="3" width="15.6" height="18" rx="3.4" />
      <path d="M8 8.6h8M8 12.4h8M8 16.2h4.6" />
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

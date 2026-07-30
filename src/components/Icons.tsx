/**
 * Symbole als Strichzeichnungen.
 *
 * Selbst gezeichnet statt aus einer Bibliothek: Es sind acht Stück, und eine
 * Symbolbibliothek wiegt mehr als die halbe App.
 */

interface Props {
  size?: number
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

export function IconHome({ size = 22 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  )
}

export function IconWallet({ size = 22 }: Props) {
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

export function IconCart({ size = 22 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M2.5 3.5h2.2l2.2 11h10.4" />
      <path d="M6.4 6.5H21l-1.6 6.2H7.6" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17.5" cy="19" r="1.5" />
    </svg>
  )
}

export function IconFridge({ size = 22 }: Props) {
  return (
    <svg {...base(size)}>
      <rect x="5" y="2.5" width="14" height="19" rx="3" />
      <path d="M5 10h14" />
      <path d="M8.5 6v1.8M8.5 13v2.4" />
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

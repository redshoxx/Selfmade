import type { Tab } from '../lib/types'
import { IconCart, IconFridge, IconHome, IconTarget, IconWallet } from './Icons'

interface Props {
  active: Tab
  counts: Partial<Record<Tab, { value: number; urgent: boolean }>>
  onChange: (tab: Tab) => void
}

const TABS: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: 'start', label: 'Start', Icon: IconHome },
  { id: 'geld', label: 'Geld', Icon: IconWallet },
  { id: 'sparen', label: 'Sparen', Icon: IconTarget },
  { id: 'einkauf', label: 'Einkauf', Icon: IconCart },
  { id: 'vorrat', label: 'Vorrat', Icon: IconFridge },
]

export function TabBar({ active, counts, onChange }: Props) {
  return (
    <nav className="tabbar" aria-label="Bereiche">
      {TABS.map(({ id, label, Icon }) => {
        const badge = counts[id]
        const showBadge = badge !== undefined && badge.value > 0
        return (
          <button
            key={id}
            type="button"
            className={`tab${active === id ? ' tab-on' : ''}`}
            onClick={() => onChange(id)}
            aria-current={active === id ? 'page' : undefined}
            /* Ohne eigenen Namen läse eine Vorlesehilfe die nackte Zahl mit
               vor – „4 Einkauf“. Hier steht, was die Zahl bedeutet. */
            aria-label={
              showBadge
                ? `${label}, ${badge.value} ${badge.urgent ? 'dringend' : 'offen'}`
                : label
            }
          >
            <span className="tab-icon">
              <Icon size={22} />
              {showBadge && (
                <span
                  className={`tab-badge${badge.urgent ? '' : ' tab-badge-soft'}`}
                  aria-hidden="true"
                >
                  {badge.value > 99 ? '99+' : badge.value}
                </span>
              )}
            </span>
            <span className="tab-label">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

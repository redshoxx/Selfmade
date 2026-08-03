import type { Tab } from '../lib/types'
import { IconCart, IconFridge, IconHome, IconNote, IconWallet } from './Icons'

/**
 * Die Reiterleiste.
 *
 * Gebaut für ein iPhone, das die App vom Home-Bildschirm startet. Dort ist sie
 * das Einzige, was ständig sichtbar ist – und das Erste, woran man merkt, ob
 * etwas eine App ist oder eine Webseite in einem Rahmen. Drei Dinge machen den
 * Unterschied, und alle drei stehen im Stylesheet unter `.tabbar`: die
 * Haarlinie oben, der durchscheinende Untergrund und dass beim Langdrücken
 * kein Auswahlmenü aufgeht.
 *
 * Hier drin steckt der vierte: Hinter dem aktiven Symbol liegt eine Pille
 * (siehe `.tab-icon` im Stylesheet). Farbe allein ist ein schwaches Signal –
 * eine Fläche sieht man auch bei Sonnenlicht und ohne Farbunterscheidung.
 */

interface Props {
  active: Tab
  counts: Partial<Record<Tab, { value: number; urgent: boolean }>>
  onChange: (tab: Tab) => void
}

const TABS: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: 'start', label: 'Start', Icon: IconHome },
  { id: 'geld', label: 'Geld', Icon: IconWallet },
  { id: 'einkauf', label: 'Einkauf', Icon: IconCart },
  { id: 'vorrat', label: 'Vorrat', Icon: IconFridge },
  { id: 'notizen', label: 'Notizen', Icon: IconNote },
]

export function TabBar({ active, counts, onChange }: Props) {
  return (
    <nav className="tabbar" aria-label="Bereiche">
      {TABS.map(({ id, label, Icon }) => {
        const badge = counts[id]
        const showBadge = badge !== undefined && badge.value > 0
        const on = active === id
        return (
          <button
            key={id}
            type="button"
            className={`tab${on ? ' tab-on' : ''}`}
            onClick={() => onChange(id)}
            aria-current={on ? 'page' : undefined}
            /* Ohne eigenen Namen läse eine Vorlesehilfe die nackte Zahl mit
               vor – „4 Einkauf“. Hier steht, was die Zahl bedeutet. */
            aria-label={
              showBadge ? `${label}, ${badge.value} ${badge.urgent ? 'dringend' : 'offen'}` : label
            }
          >
            <span className="tab-icon">
              <Icon size={24} stark={on} />
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

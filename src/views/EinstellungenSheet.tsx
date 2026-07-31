import { useState } from 'react'
import { Field, TapRow } from '../components/Bits'
import { IconUsers } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { cloudConfigured } from '../lib/supabase'
import { useApp } from '../lib/useApp'
import type { Settings } from '../lib/types'

/**
 * Einstellungen.
 *
 * Das Teilen hat hier nur noch eine Zeile und einen eigenen Raum dahinter. Es
 * ist kein Schalter, sondern ein Weg über mehrere Schritte – zwischen Farbwahl
 * und Anzeigename stand er im Weg und wirkte zugleich wie eine Kleinigkeit.
 */
export function EinstellungenSheet({ onClose, onShare }: { onClose: () => void; onShare: () => void }) {
  const { state, dispatch, session, cloudStatus, signOut } = useApp()

  const [name, setName] = useState(state.settings.displayName)
  const [busy, setBusy] = useState(false)

  const set = (patch: Partial<Settings>) => dispatch({ type: 'settings/update', patch })

  const teilenStand = !cloudConfigured
    ? 'läuft nur auf diesem Gerät'
    : !session
      ? 'noch nicht angemeldet'
      : state.household
        ? `${state.household.name}${state.household.members.length > 1 ? ` · ${state.household.members.length} Personen` : ''}`
        : 'noch kein Haushalt'

  return (
    <Sheet title="Einstellungen" onClose={onClose}>
      <div className="card" style={{ marginTop: 0 }}>
        <TapRow
          title="Zu zweit nutzen"
          sub={teilenStand}
          leading={<IconUsers size={18} />}
          onClick={onShare}
        />
      </div>

      {cloudStatus === 'fehler' && (
        <div className="notice notice-warn" style={{ marginTop: 12 }}>
          <span aria-hidden="true">!</span>
          <span>Der Abgleich hakt gerade. Unter „Zu zweit nutzen“ steht, woran es liegt.</span>
        </div>
      )}

      <h2 className="section">Ich</h2>
      <div className="card pad">
        <Field label="Angezeigter Name">
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => set({ displayName: name.trim() || 'Ich' })}
            placeholder="Ich"
          />
        </Field>
        <p className="small muted" style={{ margin: 0 }}>
          Steht in der geteilten Liste hinter dem, was du aufschreibst.
        </p>
      </div>

      <h2 className="section">Darstellung</h2>
      <div className="card pad">
        <span className="field-label">Farben</span>
        <div className="segmented">
          {(['system', 'hell', 'dunkel'] as const).map((theme) => (
            <button
              key={theme}
              type="button"
              aria-pressed={state.settings.theme === theme}
              onClick={() => set({ theme })}
            >
              {theme === 'system' ? 'System' : theme === 'hell' ? 'Hell' : 'Dunkel'}
            </button>
          ))}
        </div>

        <div className="spread" style={{ marginTop: 16 }}>
          <span>
            Kurzes Rütteln beim Abhaken
            <span className="row-sub">Wo das Gerät es kann</span>
          </span>
          <button
            type="button"
            className={`btn${state.settings.haptics ? ' btn-primary' : ''}`}
            onClick={() => set({ haptics: !state.settings.haptics })}
            aria-pressed={state.settings.haptics}
            style={{ minWidth: 74 }}
          >
            {state.settings.haptics ? 'An' : 'Aus'}
          </button>
        </div>
      </div>

      {session && (
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-wide"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await signOut()
              } finally {
                setBusy(false)
              }
            }}
          >
            Abmelden ({session.email})
          </button>
        </div>
      )}

      <p className="small muted" style={{ marginTop: 18, textAlign: 'center' }}>
        Deine Daten liegen auf diesem Gerät. Was du teilst, liegt zusätzlich auf deinem eigenen
        Supabase-Projekt – sonst nirgends.
      </p>
    </Sheet>
  )
}

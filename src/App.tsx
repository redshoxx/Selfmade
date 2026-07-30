import { useEffect, useState } from 'react'
import { IconGear } from './components/Icons'
import { TabBar } from './components/TabBar'
import { pantryCounts } from './lib/pantry'
import { clearLaunchIntent, readLaunchIntent, trackKeyboardInset } from './lib/platform'
import { shopCounts } from './lib/shopping'
import { useApp } from './lib/useApp'
import type { Tab } from './lib/types'
import { EinkaufView } from './views/EinkaufView'
import { EinstellungenSheet } from './views/EinstellungenSheet'
import { GeldView } from './views/GeldView'
import { SparenView } from './views/SparenView'
import { StartView } from './views/StartView'
import { VorratView } from './views/VorratView'

export function App() {
  const { state } = useApp()

  // Startabsicht aus der Adresse genau einmal auswerten. Sie kommt von den
  // Verknüpfungen, die Android beim langen Tippen aufs App-Symbol anbietet.
  const [intent] = useState(() => {
    const parsed = readLaunchIntent()
    clearLaunchIntent()
    return parsed
  })

  const [tab, setTab] = useState<Tab>(intent.tab ?? state.settings.startTab)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => trackKeyboardInset(), [])

  const shop = shopCounts(state)
  const pantry = pantryCounts(state)

  const counts: Partial<Record<Tab, { value: number; urgent: boolean }>> = {
    einkauf: { value: shop.open, urgent: false },
    vorrat: { value: pantry.urgent, urgent: true },
  }

  return (
    <div className="app">
      {/* Der Schlüssel setzt beim Wechsel die Scrollposition zurück – sonst
          landet man in der neuen Ansicht mittendrin. */}
      <main style={{ display: 'contents' }} key={tab}>
        {tab === 'start' && <StartView onGo={setTab} />}
        {tab === 'geld' && <GeldView startCompose={intent.compose} />}
        {tab === 'sparen' && <SparenView />}
        {tab === 'einkauf' && <EinkaufView />}
        {tab === 'vorrat' && <VorratView startFilter={intent.filter ?? undefined} />}
      </main>

      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        aria-label="Einstellungen"
        style={{
          position: 'fixed',
          top: 'calc(var(--safe-t) + 10px)',
          right: 'calc(var(--safe-r) + 14px)',
          width: 40,
          height: 40,
          display: 'grid',
          placeItems: 'center',
          color: 'var(--text-3)',
          zIndex: 10,
        }}
      >
        <IconGear size={21} />
      </button>

      <TabBar active={tab} counts={counts} onChange={setTab} />

      {settingsOpen && <EinstellungenSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

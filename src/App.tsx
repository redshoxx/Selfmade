import { useCallback, useEffect, useState } from 'react'
import { TabBar } from './components/TabBar'
import { pantryCounts } from './lib/pantry'
import { clearLaunchIntent, readLaunchIntent, trackKeyboardInset } from './lib/platform'
import { shopCounts } from './lib/shopping'
import { useApp } from './lib/useApp'
import type { Tab, TxKind } from './lib/types'
import { EinkaufView } from './views/EinkaufView'
import { EinstellungenSheet } from './views/EinstellungenSheet'
import { GeldView } from './views/GeldView'
import { KontoSheet } from './views/KontoSheet'
import { NotizenView } from './views/NotizenView'
import { StartView } from './views/StartView'
import { VorratView } from './views/VorratView'

/**
 * Was beim Wechsel in einen Bereich gleich mit aufgehen soll.
 *
 * Ein Einstieg auf der Startseite soll nicht nur den Reiter umschalten, sondern
 * direkt dorthin führen, wo etwas passiert – „Ausgabe erfassen“ öffnet das
 * Formular, nicht bloß den Geld-Bereich. Weil beim Reiterwechsel neu aufgebaut
 * wird, genügt dafür eine Angabe, die die Ansicht beim Start einmal liest.
 */
export interface GoIntent {
  compose?: TxKind
  /** In Geld gleich den Spar-Bereich zeigen statt des Monats. */
  sparen?: boolean
  /** Dort zusätzlich die Challenge-Auswahl aufmachen. */
  challenge?: boolean
}

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
  const [go, setGo] = useState<GoIntent>(() => (intent.compose ? { compose: intent.compose } : {}))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [kontoOpen, setKontoOpen] = useState(false)

  useEffect(() => trackKeyboardInset(), [])

  const goTo = useCallback((next: Tab, withIntent: GoIntent = {}) => {
    setGo(withIntent)
    setTab(next)
  }, [])

  const shop = shopCounts(state)
  const pantry = pantryCounts(state)

  const counts: Partial<Record<Tab, { value: number; urgent: boolean }>> = {
    einkauf: { value: shop.open, urgent: false },
    vorrat: { value: pantry.urgent, urgent: true },
  }

  return (
    <div className="app">
      {/* Der Schlüssel setzt beim Wechsel die Scrollposition zurück – sonst
          landet man in der neuen Ansicht mittendrin. Er sorgt zugleich dafür,
          dass die Absicht oben beim Aufbau gelesen wird. */}
      <main style={{ display: 'contents' }} key={tab}>
        {tab === 'start' && (
          <StartView
            onGo={goTo}
            onKonto={() => setKontoOpen(true)}
            onEinstellungen={() => setSettingsOpen(true)}
          />
        )}
        {tab === 'geld' && (
          <GeldView
            startCompose={go.compose ?? null}
            startBereich={go.sparen || go.challenge ? 'sparen' : 'monat'}
            startPicking={go.challenge}
          />
        )}
        {tab === 'einkauf' && <EinkaufView />}
        {tab === 'vorrat' && <VorratView startFilter={intent.filter ?? undefined} />}
        {tab === 'notizen' && <NotizenView />}
      </main>

      <TabBar active={tab} counts={counts} onChange={(next) => goTo(next)} />

      {settingsOpen && (
        <EinstellungenSheet
          onClose={() => setSettingsOpen(false)}
          onKonto={() => {
            setSettingsOpen(false)
            setKontoOpen(true)
          }}
        />
      )}

      {kontoOpen && <KontoSheet onClose={() => setKontoOpen(false)} />}
    </div>
  )
}

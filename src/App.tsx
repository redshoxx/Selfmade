import { useCallback, useEffect, useState } from 'react'
import { IconGear } from './components/Icons'
import { TabBar } from './components/TabBar'
import { pantryCounts } from './lib/pantry'
import { clearLaunchIntent, readLaunchIntent, trackKeyboardInset } from './lib/platform'
import { shopCounts } from './lib/shopping'
import { useApp } from './lib/useApp'
import type { Tab, TxKind } from './lib/types'
import { EinkaufView } from './views/EinkaufView'
import { EinstellungenSheet } from './views/EinstellungenSheet'
import { GeldView } from './views/GeldView'
import { SparenView } from './views/SparenView'
import { StartView } from './views/StartView'
import { TeilenSheet } from './views/TeilenSheet'
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
  /** Im Sparen-Bereich gleich die Challenge-Auswahl zeigen. */
  challenge?: boolean
}

export function App() {
  const { state, pendingInvite, joinedHousehold } = useApp()

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
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => trackKeyboardInset(), [])

  /*
   * Wer einen Einladungslink antippt, hat schon gesagt, was er will. Die App
   * öffnet deshalb von selbst die Stelle, an der es weitergeht – sonst landet
   * er auf der Startseite und muss den Weg dorthin erst suchen. Dasselbe nach
   * einem geglückten Beitritt: Die Rückmeldung steht dort.
   */
  useEffect(() => {
    if (pendingInvite || joinedHousehold) setShareOpen(true)
  }, [pendingInvite, joinedHousehold])

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
        {tab === 'start' && <StartView onGo={goTo} onShare={() => setShareOpen(true)} />}
        {tab === 'geld' && <GeldView startCompose={go.compose ?? null} />}
        {tab === 'sparen' && <SparenView startPicking={go.challenge} />}
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
          color: 'var(--text-2)',
          zIndex: 10,
        }}
      >
        <IconGear size={21} />
      </button>

      <TabBar active={tab} counts={counts} onChange={(next) => goTo(next)} />

      {settingsOpen && (
        <EinstellungenSheet
          onClose={() => setSettingsOpen(false)}
          onShare={() => {
            setSettingsOpen(false)
            setShareOpen(true)
          }}
        />
      )}

      {shareOpen && <TeilenSheet onClose={() => setShareOpen(false)} />}
    </div>
  )
}

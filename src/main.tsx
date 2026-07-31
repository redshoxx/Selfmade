import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { Fehlerfang } from './components/Fehlerfang'
import { registerServiceWorker } from './lib/platform'
import { AppProvider } from './lib/useApp'
import './styles.css'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      {/* Außen um alles herum, auch um den Zustand: Ein Fehler beim Einlesen
          des Speichers darf ebenso wenig zu einer leeren Seite führen wie
          einer in der Darstellung. */}
      <Fehlerfang>
        <AppProvider>
          <App />
        </AppProvider>
      </Fehlerfang>
    </StrictMode>,
  )
}

registerServiceWorker()

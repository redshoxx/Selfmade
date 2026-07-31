import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Der letzte Halt vor dem weißen Bildschirm.
 *
 * React wirft bei einem Fehler im Aufbau die gesamte Oberfläche weg. Ohne
 * diese Klasse bleibt dann eine leere Seite stehen – kein Text, keine
 * Schaltfläche, nichts zum Antippen. Auf einer vom Homescreen gestarteten App
 * gibt es nicht einmal eine Adressleiste, über die man neu laden könnte; die
 * App wäre schlicht kaputt.
 *
 * Wichtiger als die Meldung ist der zweite Satz: Die Daten liegen im Speicher
 * des Browsers und sind von einem Fehler in der Darstellung nicht betroffen.
 * Wer das nicht weiß, löscht die App – und damit tatsächlich alles.
 */
interface Props {
  children: ReactNode
}

interface Zustand {
  fehler: Error | null
}

export class Fehlerfang extends Component<Props, Zustand> {
  state: Zustand = { fehler: null }

  static getDerivedStateFromError(fehler: Error): Zustand {
    return { fehler }
  }

  componentDidCatch(fehler: Error, info: ErrorInfo): void {
    // In die Konsole, nicht zu einem fremden Dienst: Die App schickt nichts
    // weg, und ein Absturzbericht wäre die erste Ausnahme davon.
    console.error('Selfmade ist gestolpert:', fehler, info.componentStack)
  }

  render(): ReactNode {
    const { fehler } = this.state
    if (!fehler) return this.props.children

    return (
      // Der äußere Rahmen gehört dazu: `.scroll` rechnet mit ihm, sonst steht
      // die Meldung randlos unter der Statusleiste – ausgerechnet dann, wenn
      // sie gelesen werden soll.
      <div className="app">
        <div className="scroll" style={{ paddingTop: 'calc(var(--safe-t) + 40px)' }}>
          <div className="head">
            <h1>Da ist etwas schiefgegangen</h1>
          </div>

          <div className="card pad">
            <p style={{ marginTop: 0 }}>
              Deine Daten sind in Ordnung. Sie liegen auf diesem Gerät und haben mit dem Fehler
              nichts zu tun.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-wide"
              onClick={() => window.location.reload()}
            >
              App neu starten
            </button>
            <p className="small muted" style={{ marginBottom: 0 }}>
              Kommt das wieder, hilft es, die Seite einmal ganz zu schließen und neu zu öffnen.
            </p>
          </div>

          <details style={{ marginTop: 14 }}>
            <summary className="small muted">Technische Einzelheiten</summary>
            <pre
              className="small"
              style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 8 }}
            >
              {fehler.message}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Die Zugangsdaten stehen bewusst nicht hier.
 *
 * Über `define` eingetragen würden sie jede andere Quelle *überschreiben* –
 * auch die Einstellungen beim Hoster und eine lokale `.env`. Man trüge sie
 * dort ein, es passierte nichts, und der Grund wäre nirgends zu sehen.
 *
 * Sie liegen deshalb als Rückfallwert in `src/lib/supabase.ts`: eingebaut,
 * damit jeder Bau ohne weiteres Zutun läuft, aber von der Umgebung
 * überstimmbar. Dort steht auch, warum der publishable key im Quelltext
 * stehen darf.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    // Ältere Safari-Versionen auf noch gepflegten iPhones sollen die Bundles lesen können.
    target: ['es2020', 'safari15'],
  },
  test: {
    /*
     * Vitest stubt CSS-Importe standardmäßig zu einem leeren String – für
     * Rechenlogik ist das richtig, denn Stile interessieren dort nicht.
     *
     * `kontrast.test.ts` braucht sie aber: Er liest die Farbwerte aus
     * `styles.css` und rechnet die Kontrastverhältnisse nach, statt sie in
     * einem Kommentar zu behaupten, der altert. Ohne diese Zeile bekäme er
     * eine leere Datei und würde stumm nichts prüfen.
     */
    css: true,
  },
})

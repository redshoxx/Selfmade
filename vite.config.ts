import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    // Ältere Safari-Versionen auf noch gepflegten iPhones sollen die Bundles lesen können.
    target: ['es2020', 'safari15'],
  },

  /**
   * Der Demo-Bau (`npm run build:demo`) bekommt keine Zugangsdaten.
   *
   * Er erzeugt eine einzelne HTML-Datei zum Weitergeben, und darin steht alles
   * im Klartext. Wären die Zugangsdaten enthalten, könnte sich jeder Empfänger
   * am fremden Supabase-Projekt anmelden und dort Haushalte anlegen.
   *
   * Bewusst hier und nicht über eine `.env.demo`: Eine sichtbare Datei mit
   * leeren Feldern lädt dazu ein, sie auszufüllen – sie sieht nach der Stelle
   * aus, an die die Zugangsdaten gehören. Hier eingetragen wirkt die Leerung
   * dagegen unabhängig davon, was in irgendeiner `.env` steht.
   */
  define:
    mode === 'demo'
      ? {
          'import.meta.env.VITE_SUPABASE_URL': '"https://ecflcrigkfyhifekwfxq.supabase.co"',
          'import.meta.env.VITE_SUPABASE_ANON_KEY': '"sb_publishable_1EpIlW3NxMKtGL4MjF2xtg_aYacqCx3"',
        }
      : {},
}))

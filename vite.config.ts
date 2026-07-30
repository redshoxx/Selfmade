import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
})

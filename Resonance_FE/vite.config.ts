import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Il browser vede una sola origine: in sviluppo e in anteprima Vite inoltra /api e /ws al backend sulla
// 8080 (progettazione, sezione 4.3). `ws: true` inoltra anche l'upgrade della connessione STOMP.
const backendProxy = {
  '/api': { target: 'http://localhost:8080' },
  '/ws': { target: 'ws://localhost:8080', ws: true },
}

// Content-Security-Policy della decisione 76: nessuno script inline, da CDN o eval. Su Render la stessa
// politica la imposta SecurityConfig (FE-11); qui serve a scoprire le violazioni prima del deploy.
const contentSecurityPolicy = [
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    proxy: backendProxy,
    // Il progetto sta in OneDrive: lì il controllo delle modifiche del disco perde aggiornamenti e il browser riceve moduli
    // vecchi. Il polling li vede sempre (costa un po' di processore solo in sviluppo; `vite preview` e il build non lo usano).
    watch: { usePolling: true, interval: 300 },
  },
  preview: {
    proxy: backendProxy,
    headers: { 'Content-Security-Policy': contentSecurityPolicy },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})

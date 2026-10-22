import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Server di sviluppo di Vite: il progetto sta in una cartella di OneDrive, dove il controllo delle modifiche del disco perde
// aggiornamenti e il browser riceveva moduli vecchi (visto con la barra di navigazione e con le righe admin). Il controllo a
// intervalli (polling) lo evita. Si legge il testo del file: importarlo farebbe entrare `vite.config.ts` nel progetto dei test.
const config = readFileSync(path.join(import.meta.dirname, '..', 'vite.config.ts'), 'utf8')

describe('vite.config.ts · server di sviluppo', () => {
  it('controlla le modifiche dei file a intervalli (polling)', () => {
    expect(config).toMatch(/watch:\s*\{[^}]*usePolling:\s*true/)
  })

  it('tiene un intervallo di controllo esplicito, per non pesare sul processore', () => {
    expect(config).toMatch(/watch:\s*\{[^}]*interval:\s*\d+/)
  })

  it('continua a inoltrare /api e /ws al backend', () => {
    expect(config).toMatch(/server:\s*\{[^}]*proxy:\s*backendProxy/)
  })
})

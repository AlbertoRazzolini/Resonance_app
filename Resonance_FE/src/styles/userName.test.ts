import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Nome dell'utente nell'header (da 1200 px): misure relative, mai pixel fissi, così segue lo schermo e le preferenze
// del carattere. jsdom non fa il layout: qui si controlla la regola; l'effetto vero lo prova il browser a 1200, 1280 e 1920 px.
const css = readFileSync(path.join(import.meta.dirname, 'index.css'), 'utf8')

/** Corpo della prima regola con questo selettore esatto. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  expect(match, `regola ${selector}`).not.toBeNull()
  return match![1]
}

describe('nome dell\'utente nell\'header', () => {
  // Senza i commenti, che possono citare le soglie in pixel
  const body = ruleBody('.rs-user__name').replace(/\/\*[\s\S]*?\*\//g, '')

  it('cresce con la larghezza dello schermo, fra due token di corpo del testo', () => {
    expect(body).toMatch(/font-size:\s*clamp\(var\(--rs-text-base\),\s*[^,]*vw[^,]*,\s*var\(--rs-text-lg\)\)/)
  })

  it('ha una larghezza massima relativa alla larghezza dello schermo', () => {
    expect(body).toMatch(/max-width:\s*min\([\d.]+rem,\s*[\d.]+vw\)/)
  })

  it('non usa pixel fissi', () => {
    expect(body).not.toMatch(/\d\s*px/)
  })
})

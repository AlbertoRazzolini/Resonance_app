import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Schedina «ADMIN» nella colonna a sinistra: un riquadro con il bordo giallo tenue che racchiude «Utenti» e «Nascosti» e le
// distingue dalle cinque voci principali. jsdom non fa il layout: qui si controllano le regole; l'effetto lo prova il browser.
const css = readFileSync(path.join(import.meta.dirname, 'index.css'), 'utf8')

const rule = (selector: string) => {
  const escaped = selector.replace(/[.>]/g, '\\$&')
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1]
}

describe('schedina admin della colonna a sinistra', () => {
  it('`.rs-side-admin` è un riquadro con il bordo giallo tenue e gli angoli arrotondati', () => {
    const body = rule('.rs-side-admin')

    expect(body, 'regola .rs-side-admin').toBeDefined()
    expect(body).toMatch(/border:\s*1px solid rgba\(var\(--rs-color-accent-rgb\),\s*0\.\d+\)/)
    expect(body).toMatch(/border-radius:\s*var\(--rs-radius-lg\)/)
  })

  it('le voci dentro la schedina restano in colonna, con una distanza', () => {
    const body = rule('.rs-side-admin')

    expect(body).toMatch(/display:\s*flex/)
    expect(body).toMatch(/flex-direction:\s*column/)
    expect(body).toMatch(/gap:\s*var\(--rs-space-/)
  })

  it('l’etichetta «ADMIN» ha un colore giallo tenue e le lettere maiuscole spaziate', () => {
    const body = rule('.rs-side-admin__label')

    expect(body, 'regola .rs-side-admin__label').toBeDefined()
    expect(body).toMatch(/color:\s*rgba\(var\(--rs-color-accent-rgb\)/)
    expect(body).toMatch(/text-transform:\s*uppercase/)
  })
})

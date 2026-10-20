import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Spazio riservato in fondo alle pagine (decisione 83): il contenuto lascia sotto di sé tanto spazio quanto ne occupano
// il footer e, sul telefono, le tab, così non coprono mai l'ultimo elemento né la paginazione. jsdom non fa il layout:
// qui si controlla che le regole del CSS usino le stesse misure del footer e delle tab; l'effetto vero lo prova il
// controllo a 375, 768 e 1280 px nel browser.
const css = readFileSync(path.join(import.meta.dirname, 'index.css'), 'utf8')

/** Corpo della prima regola con questo selettore esatto. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  expect(match, `regola ${selector}`).not.toBeNull()
  return match![1]
}

describe('spazio riservato in fondo alle pagine', () => {
  it("il contenuto riserva sempre l'altezza del footer", () => {
    expect(ruleBody('.rs-main')).toMatch(/padding-bottom:\s*var\(--rs-footer-height\)/)
  })

  it("con le tab (telefono) riserva anche l'altezza delle tab e la zona sicura dello schermo", () => {
    const body = ruleBody('.rs-app:has(> .rs-tabbar) > .rs-main')
    expect(body).toContain('var(--rs-footer-height)')
    expect(body).toContain('var(--rs-tabbar-height)')
    expect(body).toContain('env(safe-area-inset-bottom)')
  })

  it("il footer ha proprio l'altezza che il contenuto riserva", () => {
    expect(ruleBody('.rs-footer')).toMatch(/height:\s*var\(--rs-footer-height\)/)
  })

  it("l'altezza del footer da 768 px si cambia sulla radice, così la leggono sia il footer sia il contenuto", () => {
    expect(css).toMatch(
      /@media \(min-width: 768px\)\s*\{\s*:root\s*\{\s*--rs-footer-height:\s*[\d.]+rem;/,
    )
  })

  it('il footer sta sotto le tab (z-index minore), così può uscire da dietro di esse', () => {
    const zIndex = (selector: string) => Number(/z-index:\s*(\d+)/.exec(ruleBody(selector))?.[1])
    expect(zIndex('.rs-footer')).toBeLessThan(zIndex('.rs-tabbar'))
  })
})

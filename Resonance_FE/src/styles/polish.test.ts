import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Rifinitura di FE-12: jsdom non fa il layout, quindi si controlla che le regole del CSS ci siano; l'effetto vero lo
// prova il controllo a 375, 768 e 1280 px nel browser.
const index = readFileSync(path.join(import.meta.dirname, 'index.css'), 'utf8')
const overrides = readFileSync(path.join(import.meta.dirname, 'bootstrap-overrides.css'), 'utf8')

/** Corpo della prima regola con questo selettore esatto, cercata in un testo CSS. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  expect(match, `regola ${selector}`).not.toBeNull()
  return match![1]
}

describe('footer nelle pagine senza colonna', () => {
  it('lo spostamento a destra della colonna vale solo con la colonna (rs-app--side)', () => {
    expect(ruleBody(index, '.rs-app--side > .rs-footer')).toMatch(/left:\s*4\.5rem/)
    expect(index).toMatch(/\.rs-app--side > \.rs-footer\s*\{\s*left:\s*15rem/)
  })

  it('la regola generale del footer non sposta il bordo sinistro', () => {
    expect(ruleBody(index, '.rs-footer')).not.toMatch(/(^|[\s;])left:/)
    expect(index).not.toMatch(/\n\s+\.rs-footer\s*\{\s*left:/)
  })
})

describe('bersagli di tocco', () => {
  it('sugli schermi touch i pulsanti piccoli sono alti almeno 40 px', () => {
    expect(overrides).toMatch(/@media \(pointer: coarse\)\s*\{[^@]*\.btn-sm[^}]*min-height:\s*2\.5rem/)
  })
})

describe('campanella al tocco', () => {
  it('sugli schermi touch la campanella è alta e larga almeno 40 px', () => {
    expect(index).toMatch(/@media \(pointer: coarse\)\s*\{\s*\.rs-bell\s*\{[^}]*min-height:\s*2\.5rem[^}]*min-width:\s*2\.5rem/)
  })
})

describe('stati vuoti e form', () => {
  it("l'azione dello stato vuoto ha spazio sopra", () => {
    expect(ruleBody(index, '.rs-empty .btn')).toMatch(/margin-top:\s*var\(--rs-space-3\)/)
  })

  it('il titolo dei form di creazione ha spazio sotto', () => {
    expect(ruleBody(index, '.rs-edit > h1')).toMatch(/margin-bottom:\s*var\(--rs-space-4\)/)
  })
})

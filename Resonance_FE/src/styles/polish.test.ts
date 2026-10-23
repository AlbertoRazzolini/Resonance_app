import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Rifinitura di FE-12: jsdom non fa il layout, quindi si controlla che le regole del CSS ci siano; l'effetto vero lo
// prova il controllo a 375, 768 e 1280 px nel browser.
const index = readFileSync(path.join(import.meta.dirname, 'index.css'), 'utf8')
const overrides = readFileSync(path.join(import.meta.dirname, 'bootstrap-overrides.css'), 'utf8')
const tokens = readFileSync(path.join(import.meta.dirname, 'tokens.css'), 'utf8')

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

describe('aspetto dei pulsanti (scelte dello studente, decisione 107)', () => {
  it("il pulsante principale è giallo come l'accento, con la scritta scura dell'accento", () => {
    expect(tokens).toMatch(/--rs-color-button:\s*var\(--rs-color-accent\)/)
    expect(tokens).toMatch(/--rs-color-button-hover:\s*var\(--rs-color-accent-hover\)/)
    expect(tokens).toMatch(/--rs-color-button-ink:\s*var\(--rs-color-accent-ink\)/)
  })

  it('tutti i pulsanti, anche piccoli e grandi, hanno gli angoli a 8 px (--rs-radius-lg)', () => {
    expect(overrides).toMatch(
      /\.btn,\s*\.btn-sm,\s*\.btn-lg\s*\{[^}]*--bs-btn-border-radius:\s*var\(--rs-radius-lg\)/,
    )
    expect(tokens).toMatch(/--rs-radius-lg:\s*8px/)
  })
})

describe("«Modifica profilo» con l'involucro di Magnet", () => {
  // Con il mouse il pulsante sta dentro `.rs-magnet`: le regole che lo posizionano devono valere anche così, altrimenti
  // sul desktop perde il margine sotto l'avatar e la larghezza
  it("il margine sotto l'avatar vale anche per l'involucro", () => {
    expect(index).toMatch(/\.rs-profile__head \+ \.btn,\s*\.rs-profile__head \+ \.rs-magnet\s*\{[^}]*margin-top:\s*var\(--rs-space-4\)/)
  })

  it("a tutta larghezza sul telefono e della misura del testo da 768 px anche dentro l'involucro", () => {
    expect(index).toMatch(/\.rs-profile > \.btn,\s*\.rs-profile > \.rs-magnet,\s*\.rs-profile > \.rs-magnet \.btn\s*\{[^}]*width:\s*100%/)
    expect(index).toMatch(/\.rs-profile > \.btn,\s*\.rs-profile > \.rs-magnet \.btn\s*\{[^}]*padding-inline:\s*var\(--rs-space-6\)/)
  })
})

describe('schede degli eventi vicini', () => {
  it("le tre schede stanno a 16 px una dall'altra, così con Magnet non si sovrappongono", () => {
    expect(ruleBody(index, '.rs-event-tabs')).toMatch(/gap:\s*var\(--rs-space-4\)/)
  })
})

describe('scritta centrata nei pulsanti piccoli al tocco', () => {
  it('sugli schermi touch i pulsanti piccoli centrano la scritta in verticale e in orizzontale', () => {
    // Con min-height da solo la scritta resterebbe in alto (un collegamento è inline-block): serve il flex
    const match = /@media \(pointer: coarse\)\s*\{[^@]*\.btn-sm\s*\{([^}]*)\}/.exec(overrides)
    expect(match, 'regola .btn-sm per il touch').not.toBeNull()
    expect(match![1]).toMatch(/display:\s*inline-flex/)
    expect(match![1]).toMatch(/align-items:\s*center/)
    expect(match![1]).toMatch(/justify-content:\s*center/)
  })
})

describe('campanella al tocco', () => {
  it('sugli schermi touch la campanella è alta e larga almeno 40 px', () => {
    expect(index).toMatch(/@media \(pointer: coarse\)\s*\{\s*\.rs-bell\s*\{[^}]*min-height:\s*2\.5rem[^}]*min-width:\s*2\.5rem/)
  })
})

describe('intestazione con pulsante (Collab, Amici, Cerca persone)', () => {
  it("lo spazio sotto l'intestazione sta sull'intestazione, non sul sottotitolo, così un pulsante andato a capo non tocca ciò che segue", () => {
    expect(ruleBody(index, '.rs-collab-head')).toMatch(/margin-bottom:\s*var\(--rs-space-5\)/)
    expect(ruleBody(index, '.rs-collab-head p')).toMatch(/margin-bottom:\s*0/)
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

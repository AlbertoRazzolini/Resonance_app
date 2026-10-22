import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Righe dell'area admin: da 992 px le celle diventano celle di tabella e lì il `gap` non vale, quindi nome ed email, pulsanti e
// frasi restavano attaccati. Il contenuto di ogni cella sta in un contenitore flex con la sua distanza; jsdom non fa il
// layout: qui si controllano le regole, l'effetto vero lo prova il browser.
const css = readFileSync(path.join(import.meta.dirname, 'index.css'), 'utf8')

const rule = (selector: string) => {
  const escaped = selector.replace(/[.>]/g, '\\$&')
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1]
}

describe('contenuto delle celle dell’area admin', () => {
  it('`.rs-admin-row__cell` è un contenitore flex che va a capo e tiene una distanza', () => {
    const body = rule('.rs-admin-row__cell')

    expect(body, 'regola .rs-admin-row__cell').toBeDefined()
    expect(body).toMatch(/display:\s*flex/)
    expect(body).toMatch(/flex-wrap:\s*wrap/)
    expect(body).toMatch(/gap:\s*var\(--rs-space-2\)/)
  })

  it('`.rs-admin-row__cell--stack` mette nome ed email in colonna, con una distanza fra le due righe', () => {
    const body = rule('.rs-admin-row__cell--stack')

    expect(body, 'regola .rs-admin-row__cell--stack').toBeDefined()
    expect(body).toMatch(/flex-direction:\s*column/)
    expect(body).toMatch(/gap:\s*var\(--rs-space-1\)/)
  })

  it('i pulsanti della cella finale sono più distanziati fra loro e allineati in alto', () => {
    const body = rule('.rs-admin-row__actions .rs-admin-row__cell')

    expect(body, 'regola .rs-admin-row__actions .rs-admin-row__cell').toBeDefined()
    expect(body).toMatch(/gap:\s*var\(--rs-space-3\)/)
    expect(body).toMatch(/align-items:\s*flex-start/)
  })

  it('da 992 px (tabella) i pulsanti della riga restano affiancati e non vanno a capo', () => {
    // La colonna delle azioni si restringeva al pulsante più largo e li metteva uno sopra l'altro (visto con Playwright a 1280 px)
    const match =
      /@media \(min-width: 992px\) \{\s*\.rs-admin-table \{[\s\S]*?\.rs-admin-row__actions \.rs-admin-row__cell \{([^}]*)\}/.exec(css)

    expect(match, 'regola della cella delle azioni da 992 px').not.toBeNull()
    expect(match![1]).toMatch(/flex-wrap:\s*nowrap/)
  })

  it('`.rs-admin-action` mette il pulsante sopra e la sua frase sotto, con una distanza', () => {
    const body = rule('.rs-admin-action')

    expect(body, 'regola .rs-admin-action').toBeDefined()
    expect(body).toMatch(/display:\s*flex/)
    expect(body).toMatch(/flex-direction:\s*column/)
    expect(body).toMatch(/gap:\s*var\(--rs-space-1\)/)
  })
})

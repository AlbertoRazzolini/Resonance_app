import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Moduli sotto i dettagli: `.rs-event-detail` allinea i figli a sinistra e li stringe al contenuto, quindi un modulo
// (contatto dell'organizzatore, candidatura a un annuncio) si ridurrebbe alla larghezza della sua casella. Ogni modulo
// deve avere `align-self: stretch`. jsdom non fa il layout: qui si controlla la regola; l'effetto vero lo prova il browser.
const css = readFileSync(path.join(import.meta.dirname, 'index.css'), 'utf8')

describe('moduli nei dettagli', () => {
  it.each(['.rs-contact', '.rs-apply'])('%s occupa tutta la larghezza del dettaglio', (selector) => {
    const escaped = selector.replace('.', '\\.')
    const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)

    expect(match, `regola ${selector}`).not.toBeNull()
    expect(match![1]).toMatch(/align-self:\s*stretch/)
  })

  // Il magnete del pulsante di candidatura (15°, 1,15) lo fa uscire di circa 28 px dal riquadro e spostare fino a
  // circa 11 px: con i 12 px di distanza dei figli del dettaglio toccava «Torna su Collab»
  it("sotto il modulo di candidatura c'è più spazio dell'uscita del magnete, ma non con la candidatura già inviata", () => {
    const match = /(?:^|\n)\.rs-apply:not\(\.rs-apply--sent\)\s*\{([^}]*)\}/.exec(css)

    expect(match, 'regola .rs-apply:not(.rs-apply--sent)').not.toBeNull()
    expect(match![1]).toMatch(/margin-bottom:\s*var\(--rs-space-6\)/)
  })
})

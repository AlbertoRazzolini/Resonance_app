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
})

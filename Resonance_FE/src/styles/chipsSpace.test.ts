import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Spazio dei generi: l'elenco dei chip riserva già l'altezza di una riga, così la prima card non fa scorrere i pulsanti.
// Se scorresse, «Pubblica» si sposterebbe da sotto il mouse nel momento in cui il clic toglie il focus al campo dei
// generi (che aggiunge la card) e l'invio andrebbe a vuoto: servirebbe un secondo clic. jsdom non fa il layout: qui si
// controlla la regola; l'effetto vero lo prova il browser.
const css = readFileSync(path.join(import.meta.dirname, 'index.css'), 'utf8')

describe('spazio dei chip dei generi', () => {
  it("l'elenco ha un'altezza minima pari a una riga di chip (pulsante «togli» di 1,5 rem più i bordi)", () => {
    const match = /(?:^|\n)\.rs-chips\s*\{([^}]*)\}/.exec(css)

    expect(match, 'regola .rs-chips').not.toBeNull()
    expect(match![1]).toMatch(/min-height:\s*calc\(1\.5rem \+ 2px\)/)
  })
})

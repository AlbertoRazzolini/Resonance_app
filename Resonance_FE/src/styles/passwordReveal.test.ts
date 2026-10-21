import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Occhio della password: il campo ha il proprio pulsante «Mostra la password» (`PasswordField`), quindi quello che Edge
// aggiunge da solo (`::-ms-reveal`) va nascosto, altrimenti gli occhi sono due. jsdom non disegna i pseudo-elementi:
// qui si controlla che la regola ci sia; l'effetto lo vede chi apre l'accesso in Edge.
const css = readFileSync(path.join(import.meta.dirname, 'index.css'), 'utf8')

describe('occhio della password', () => {
  it("nasconde quello del browser nel campo password dell'app", () => {
    const match = /\.rs-password\s+input::-ms-reveal\s*\{([^}]*)\}/.exec(css)

    expect(match, 'regola .rs-password input::-ms-reveal').not.toBeNull()
    expect(match![1]).toMatch(/display:\s*none/)
  })
})

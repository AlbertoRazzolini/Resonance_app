import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Messaggi da 1200 px: l'elenco sta in una colonna di 22 rem. Un'anteprima lunga (senza andare a capo) allargava la colonna
// implicita della griglia dell'elenco e le righe, con «Scrivi a un amico», finivano sotto il pannello della conversazione
// (25 ottobre). jsdom non fa il layout: si controlla che le due griglie dell'elenco abbiano la colonna che non si allarga
// e che l'altezza della chat tolga margine, spazio interno e bordo del pannello.
// I fine riga si normalizzano: con Git su Windows il file può arrivare con CRLF.
const css = readFileSync(path.join(import.meta.dirname, 'index.css'), 'utf8').replaceAll('\r\n', '\n')

/** Corpo della prima regola con questo selettore esatto, a inizio riga. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>:]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  expect(match, `regola ${selector}`).not.toBeNull()
  return match![1]
}

describe('elenco delle conversazioni', () => {
  it.each(['.rs-conversations', '.rs-conversation-list'])('%s ha una sola colonna che non supera lo spazio disponibile', (selector) => {
    expect(ruleBody(selector)).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  })
})

// Da 1200 px il contenuto sta in un pannello con margine, spazio interno e bordo: l'altezza della chat (conversazione e
// riquadro «Scegli una conversazione») deve toglierli, altrimenti il pannello esce dal fondo della finestra e la pagina
// scorre. L'altezza sta in una sola proprietà, `--rs-chat-height`, usata da tutte e due.
describe('altezza della chat da 1200 px', () => {
  it('toglie margine, spazio interno e bordo del pannello', () => {
    const match = /@media \(min-width: 1200px\) \{[^@]*?\n {2}\.rs-chat \{([^}]*)\}/.exec(css)
    expect(match, 'regola della chat da 1200 px').not.toBeNull()
    const rule = match![1]
    expect(rule).toMatch(/--rs-chat-height:\s*calc\(/)
    for (const token of ['100dvh', '--rs-topbar-height', '--rs-space-4', '--rs-space-5', '--rs-space-6']) {
      expect(rule).toContain(token)
    }
  })

  it("la conversazione usa l'altezza della chat e il riquadro vuoto la stessa, meno il footer", () => {
    expect(ruleBody('.rs-conversation-view')).toContain('var(--rs-chat-height')
    const empty = /\n {2}\.rs-chat__panel--empty \{([^}]*)\}/.exec(css)
    expect(empty, 'regola del pannello vuoto').not.toBeNull()
    // Con l'elenco c'è il footer (nella conversazione no): il riquadro ne toglie lo spazio, così la pagina non scorre
    expect(empty![1]).toContain('height: calc(var(--rs-chat-height) - var(--rs-footer-height) - var(--rs-space-4))')
  })
})

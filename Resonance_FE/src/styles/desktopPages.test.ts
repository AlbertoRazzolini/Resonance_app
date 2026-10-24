import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Stile della landing sulle pagine dell'app da 1200 px (FE-22): pannello in vetro opaco, titoli grandi in maiuscolo,
// righe sottili al posto dei riquadri. jsdom non fa il layout: si controlla che le regole ci siano, solo da 1200 px
// (telefono e tablet non cambiano); l'effetto vero lo prova il controllo a 375, 768 e 1280 px nel browser.
const css = readFileSync(path.join(import.meta.dirname, 'index.css'), 'utf8')

/** Il testo dei blocchi `@media (min-width: 1200px)` aggiunti da FE-22 (gli ultimi due del file). */
const desktop = css
  .split('@media (min-width: 1200px) {')
  .slice(-2)
  .join('\n')

/** Corpo della prima regola con questo selettore esatto dentro `desktop`. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>:]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(desktop)
  expect(match, `regola ${selector}`).not.toBeNull()
  return match![1]
}

describe('pagine dell\'app da 1200 px', () => {
  it('il contenuto sta in un pannello con vetro sfocato e filo di luce in alto', () => {
    const body = ruleBody('.rs-app--side > .rs-main > .container')
    expect(body).toContain('backdrop-filter: blur(')
    expect(body).toContain('inset 0 1px 0')
  })

  it('sotto il pannello c\'è lo spazio del footer più quello che sta sopra, ma non nella conversazione', () => {
    const body = ruleBody('.rs-app:not(.rs-app--conversation) > .rs-main')
    expect(body).toMatch(/padding-bottom:\s*calc\(var\(--rs-footer-height\) \+ var\(--rs-space-4\)\)/)
    expect(ruleBody('.rs-app--side > .rs-main > .container')).toMatch(/margin:\s*var\(--rs-space-4\) auto 0/)
  })

  it('i titoli di pagina sono grandi e in maiuscolo, tranne il nome nel profilo', () => {
    const body = ruleBody('.rs-app--side .rs-main .container h1:not(.rs-profile__name)')
    expect(body).toContain('text-transform: uppercase')
    expect(body).toContain('font-size: 3.5rem')
  })

  it('eventi, annunci, miei eventi e conversazioni sono righe sottili, senza riquadro né ombra', () => {
    const body = ruleBody('.rs-event-card,\n  .rs-collab-card,\n  .rs-my-event,\n  .rs-conversation')
    expect(body).toMatch(/border:\s*0/)
    expect(body).toMatch(/border-top:\s*1px solid/)
    expect(body).toContain('background: transparent')
    expect(body).toContain('box-shadow: none')
  })

  it('una conversazione non letta si segna con un punto giallo, non con un bordo spesso', () => {
    expect(ruleBody('.rs-conversation--unread::before')).toContain('background: var(--rs-color-accent)')
  })

  it("i post del feed restano in riquadro: nessuna regola da 1200 px li tocca", () => {
    expect(desktop).not.toContain('.rs-post')
  })
})

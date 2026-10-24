import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Le card di accesso (registrazione, accesso, verifica email, password dimenticata, reset), da 1200 px, stanno al
// centro verticale dello schermo invece che ancorate in alto (segnalato dallo studente il 24 ottobre); sotto 1200 px
// restano come prima. jsdom non fa il layout: qui si controlla solo che la regola ci sia; l'effetto vero lo prova il
// controllo a 375, 768 e 1280 px nel browser.
const css = readFileSync(path.join(import.meta.dirname, 'index.css'), 'utf8')
const layout = readFileSync(
  path.join(import.meta.dirname, '..', 'components', 'layout', 'AuthLayout.tsx'),
  'utf8',
)

/** Corpo della prima regola con questo selettore esatto dentro un blocco `@media (min-width: 1200px)`. */
function desktopRuleBody(selector: string): string {
  const desktop = css.split('@media (min-width: 1200px) {').slice(1).join('\n')
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>:]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(desktop)
  expect(match, `regola ${selector}`).not.toBeNull()
  return match![1]
}

describe('centraggio verticale delle card di accesso da 1200 px', () => {
  it('AuthLayout marca il proprio .rs-app con rs-app--auth', () => {
    expect(layout).toContain('"rs-app rs-app--auth"')
  })

  it('da 1200 px .rs-main diventa una colonna centrata in verticale', () => {
    const body = desktopRuleBody('.rs-app--auth > .rs-main')
    expect(body).toContain('display: flex')
    expect(body).toContain('flex-direction: column')
    expect(body).toContain('justify-content: center')
  })

  it('sotto 1200 px non cambia nulla: nessuna regola rs-app--auth fuori dal blocco desktop', () => {
    const beforeDesktop = css.split('@media (min-width: 1200px) {')[0]
    expect(beforeDesktop).not.toContain('rs-app--auth')
  })
})

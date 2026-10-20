import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Verifica che ogni variabile --rs-* usata dai fogli di stile sia definita in tokens.css: in CSS una variabile
// mancante non dà errori, il valore sparisce in silenzio. I file si leggono con fs perché in Vitest l'import
// `?raw` di un .css restituisce una stringa vuota e i controlli passerebbero a vuoto.
const read = (file: string) => readFileSync(path.join(import.meta.dirname, file), 'utf8')

const defined = new Set(
  [...read('tokens.css').matchAll(/(--rs-[\w-]+)\s*:/g)].map((match) => match[1]),
)

describe('token di design', () => {
  it('definisce il bagliore da palco e il colore di accento', () => {
    expect(defined.size).toBeGreaterThan(30)
    expect(defined).toContain('--rs-spotlight-layers')
    expect(defined).toContain('--rs-color-accent')
  })

  it('il pulsante primario spento è grigio scuro con testo grigio, non sbiadito', () => {
    const css = read('bootstrap-overrides.css')
    expect(css).toMatch(/--bs-btn-disabled-bg:\s*var\(--rs-color-border\)/)
    expect(css).toMatch(/--bs-btn-disabled-color:\s*var\(--rs-color-text-muted\)/)
    expect(css).toMatch(/--bs-btn-disabled-opacity:\s*1/)
  })

  it.each(['tokens.css', 'bootstrap-overrides.css', 'index.css'])(
    '%s usa solo variabili --rs-* definite',
    (file) => {
      const used = [...read(file).matchAll(/var\((--rs-[\w-]+)/g)].map((match) => match[1])
      expect(used.length).toBeGreaterThan(0)
      expect(used.filter((name) => !defined.has(name))).toEqual([])
    },
  )
})

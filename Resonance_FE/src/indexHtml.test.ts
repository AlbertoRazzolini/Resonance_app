import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Pagina di ingresso: la favicon (SVG, PNG da 32 e icona per iPhone) e il colore del tema devono essere collegati e i file
// devono esistere in `public/`, da cui Vite li copia alla radice (decisione 111). Si legge il testo di index.html.
const root = path.join(import.meta.dirname, '..')
const html = readFileSync(path.join(root, 'index.html'), 'utf8')

/** Indirizzo del file collegato dal tag `<link>` con quel `rel` (e, se indicato, quella dimensione). */
function linkedHref(rel: string, sizes?: string): string | undefined {
  const tag = html
    .match(/<link\b[^>]*>/g)
    ?.find(
      (t) => t.includes(`rel="${rel}"`) && (sizes === undefined || t.includes(`sizes="${sizes}"`)),
    )
  return tag?.match(/href="([^"]+)"/)?.[1]
}

describe('index.html · favicon e colore del tema', () => {
  it.each([
    ['icon', undefined, 'image/svg+xml'],
    ['icon', '32x32', 'image/png'],
    ['apple-touch-icon', '180x180', 'image/png'],
  ])('collega %s %s e il file esiste in public/', (rel, sizes, type) => {
    const href = linkedHref(rel, sizes)

    expect(href, `link ${rel} ${sizes ?? ''}`).toBeDefined()
    expect(href).toMatch(/^\/[^/]+\.(svg|png)$/)
    expect(html).toContain(`type="${type}"`)
    expect(existsSync(path.join(root, 'public', href!.slice(1)))).toBe(true)
  })

  it("tiene l'icona da 512 px in public/, per anteprime e installazione futura", () => {
    expect(existsSync(path.join(root, 'public', 'icon-512.png'))).toBe(true)
  })

  it('usa il nero dello sfondo come colore del tema', () => {
    expect(html).toMatch(/<meta\s+name="theme-color"\s+content="#0a0a0a"/)
  })

  it('non carica icone da altri siti (decisione 76)', () => {
    expect(html).not.toMatch(/(?:href|src)="https?:\/\//)
  })
})

import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '@/test/viewport'
import { LandingRings } from './LandingRings'

// Sfondo animato della landing: da tablet (768 px) gli anelli si muovono, sul telefono restano fermi, e la risoluzione
// ha un tetto sui pixel. Gli anelli veri (WebGL2) in jsdom non esistono: il componente è sostituito da una finta che
// mostra le impostazioni ricevute.
vi.mock('@/components/motion/MagicRings', () => ({
  default: (props: Record<string, unknown>) => (
    <div
      data-testid="rings"
      data-speed={String(props.speed)}
      data-intro={String(props.intro)}
      data-click-burst={String(props.clickBurst)}
      data-ratio={String(props.maxDevicePixelRatio)}
      data-has-burst-ref={String(props.burstRef !== undefined)}
    />
  ),
}))

const { innerWidth, innerHeight } = window

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: innerWidth })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight })
})

describe('LandingRings', () => {
  it('da tablet in su gli anelli si muovono, con introduzione e onda su richiesta', async () => {
    setViewportWidth(768)
    render(<LandingRings burstRef={createRef()} />)

    const rings = await screen.findByTestId('rings')
    expect(Number(rings.dataset.speed)).toBeGreaterThan(0)
    expect(rings.dataset.intro).toBe('true')
    expect(rings.dataset.hasBurstRef).toBe('true')
  })

  it("sul telefono gli anelli restano fermi, senza introduzione, e c'è comunque lo sfondo", async () => {
    setViewportWidth(767)
    render(<LandingRings burstRef={createRef()} />)

    const rings = await screen.findByTestId('rings')
    expect(rings.dataset.speed).toBe('0')
    expect(rings.dataset.intro).toBe('false')
  })

  it("l'onda parte solo dallo scroll: il clic non la fa partire", async () => {
    render(<LandingRings burstRef={createRef()} />)

    expect((await screen.findByTestId('rings')).dataset.clickBurst).toBe('false')
  })

  it('con «riduci animazioni» gli anelli restano fermi anche su desktop', async () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: /prefers-reduced-motion/.test(query) ? true : original(query).matches,
    })) as typeof window.matchMedia
    render(<LandingRings burstRef={createRef()} />)

    expect((await screen.findByTestId('rings')).dataset.speed).toBe('0')
    window.matchMedia = original
  })

  it('la risoluzione ha un tetto che dipende dalla dimensione della finestra', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 2552 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1300 })
    render(<LandingRings burstRef={createRef()} />)

    const ratio = Number((await screen.findByTestId('rings')).dataset.ratio)
    expect(ratio).toBeCloseTo(0.78, 2)
  })
})

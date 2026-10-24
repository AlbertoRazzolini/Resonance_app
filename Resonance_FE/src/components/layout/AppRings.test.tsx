import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '@/test/viewport'
import { AppRings } from './AppRings'

// Anelli dietro alle pagine dell'app (FE-22): solo da 1200 px, fermi, con un'onda a ogni cambio di pagina e senza
// onda con «riduci animazioni». Gli anelli veri (WebGL2) in jsdom non esistono: il componente è sostituito da una finta
// che mostra le impostazioni ricevute e registra la funzione dell'onda.
const burst = vi.fn()

vi.mock('@/components/motion/MagicRings', () => ({
  default: (props: { speed: number; burstRef: { current: (() => void) | null } }) => {
    props.burstRef.current = burst
    return <div data-testid="rings" data-speed={String(props.speed)} />
  },
}))

/** Pulsante che cambia pagina, per provare l'onda. */
function GoTo({ to }: { to: string }) {
  const navigate = useNavigate()
  return <button onClick={() => navigate(to)}>vai</button>
}

function renderRings() {
  return render(
    <MemoryRouter initialEntries={['/eventi']}>
      <AppRings />
      <GoTo to="/feed" />
    </MemoryRouter>,
  )
}

function stubReducedMotion(reduced: boolean) {
  const original = window.matchMedia
  window.matchMedia = (query: string) =>
    ({
      ...original(query),
      matches: query.includes('prefers-reduced-motion') ? reduced : original(query).matches,
    }) as MediaQueryList
}

const { matchMedia } = window

afterEach(() => {
  burst.mockClear()
  window.matchMedia = matchMedia
})

describe('AppRings', () => {
  it('sul telefono e sul tablet non disegna niente', () => {
    for (const width of [375, 768, 1199]) {
      setViewportWidth(width)
      const { container, unmount } = renderRings()
      expect(container.querySelector('.rs-app-rings')).toBeNull()
      unmount()
    }
  })

  it('da 1200 px disegna gli anelli fermi, nascosti agli screen reader', async () => {
    setViewportWidth(1200)
    const { container } = renderRings()

    expect(await screen.findByTestId('rings')).toHaveAttribute('data-speed', '0')
    expect(container.querySelector('.rs-app-rings')).toHaveAttribute('aria-hidden', 'true')
  })

  it("all'apertura non parte nessuna onda, al cambio di pagina sì", async () => {
    setViewportWidth(1200)
    renderRings()
    await screen.findByTestId('rings')
    expect(burst).not.toHaveBeenCalled()

    await act(async () => screen.getByRole('button', { name: 'vai' }).click())

    expect(burst).toHaveBeenCalledTimes(1)
  })

  it('con «riduci animazioni» il cambio di pagina non fa partire l\'onda', async () => {
    setViewportWidth(1200)
    stubReducedMotion(true)
    renderRings()
    await screen.findByTestId('rings')

    await act(async () => screen.getByRole('button', { name: 'vai' }).click())

    expect(burst).not.toHaveBeenCalled()
  })
})

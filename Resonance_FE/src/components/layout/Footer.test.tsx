import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { Footer } from './Footer'

// Footer a comparsa (decisione 83): quattro voci (due pagine vere, due segnaposto vuoti) che salgono dal basso solo
// quando la pagina è scrollata in fondo, o subito se la pagina non scorre; nascosto non si raggiunge con la tastiera.
function setScroll({
  scrollY,
  scrollHeight,
  innerHeight = 800,
}: {
  scrollY: number
  scrollHeight: number
  innerHeight?: number
}) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight })
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  })
  fireEvent.scroll(window)
}

afterEach(() => {
  Reflect.deleteProperty(window, 'scrollY')
  Reflect.deleteProperty(window, 'innerHeight')
  Reflect.deleteProperty(document.documentElement, 'scrollHeight')
})

function renderFooter() {
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  )
  return screen.getByRole('contentinfo', { hidden: true })
}

describe('Footer', () => {
  it('ha le due informative come collegamenti veri', () => {
    renderFooter()

    expect(screen.getByRole('link', { name: 'Informativa privacy', hidden: true })).toHaveAttribute(
      'href',
      ROUTES.privacy,
    )
    expect(screen.getByRole('link', { name: 'Informativa cookie', hidden: true })).toHaveAttribute(
      'href',
      ROUTES.cookies,
    )
  })

  it('ha copyright e termini di servizio come segnaposto vuoti: collegamenti disattivati senza indirizzo', () => {
    renderFooter()

    for (const name of ['Copyright', 'Termini di servizio']) {
      const placeholder = screen.getByRole('link', { name, hidden: true })
      expect(placeholder).not.toHaveAttribute('href')
      expect(placeholder).toHaveAttribute('aria-disabled', 'true')
    }
  })

  it('resta nascosto e fuori dalla tastiera finché la pagina non è scrollata in fondo', () => {
    const footer = renderFooter()
    setScroll({ scrollY: 0, scrollHeight: 3000 })

    expect(footer).toHaveAttribute('data-visible', 'false')
    expect(footer).toHaveAttribute('inert')
  })

  it('compare quando si arriva in fondo alla pagina', () => {
    const footer = renderFooter()
    setScroll({ scrollY: 2200, scrollHeight: 3000 })

    expect(footer).toHaveAttribute('data-visible', 'true')
    expect(footer).not.toHaveAttribute('inert')
  })

  it('scompare risalendo la pagina', () => {
    const footer = renderFooter()
    setScroll({ scrollY: 2200, scrollHeight: 3000 })
    setScroll({ scrollY: 1000, scrollHeight: 3000 })

    expect(footer).toHaveAttribute('data-visible', 'false')
  })

  it('compare subito su una pagina che non scorre', () => {
    const footer = renderFooter()
    setScroll({ scrollY: 0, scrollHeight: 800 })

    expect(footer).toHaveAttribute('data-visible', 'true')
  })
})

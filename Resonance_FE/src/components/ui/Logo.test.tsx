import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Logo } from './Logo'

// Marchio «RES + microfono con anelli + NANCE» come SVG: un solo nome accessibile e nessuna scritta da leggere due volte.
describe('Logo', () => {
  it("ha il nome accessibile «Resonance» ed è un'immagine", () => {
    render(<Logo />)

    expect(screen.getByRole('img', { name: 'Resonance' })).toBeInTheDocument()
  })

  it('è un SVG con lettere e simbolo in tracciati, senza testo del documento', () => {
    const { container } = render(<Logo />)
    const svg = container.querySelector('svg')

    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('viewBox')
    expect(svg?.querySelectorAll('path').length).toBeGreaterThanOrEqual(4)
    expect(container.textContent).toBe('')
    expect(container.querySelector('text')).toBeNull()
  })

  it('tiene i tre anelli e il microfono nel colore di accento', () => {
    const { container } = render(<Logo />)

    expect(container.querySelectorAll('.rs-logo__ring')).toHaveLength(3)
    expect(container.querySelector('.rs-logo__mic')).not.toBeNull()
  })

  it('aggiunge la classe ricevuta', () => {
    const { container } = render(<Logo className="extra" />)

    expect(container.querySelector('svg')).toHaveClass('rs-logo', 'extra')
  })
})

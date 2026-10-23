import { render, screen } from '@testing-library/react'
import { MemoryRouter, Link } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StarBorder from './StarBorder'

// Bordo animato (ReactBits): si rende come pulsante o collegamento, passa le proprietà al elemento e non si rompe dove
// manca il canvas (jsdom). L'animazione vera si prova nel browser.
beforeEach(() => {
  // jsdom non implementa il canvas: getContext restituisce null e il componente resta un semplice elemento
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

describe('StarBorder', () => {
  it('è un pulsante di tipo button di default, con il suo testo', () => {
    render(<StarBorder>Entra</StarBorder>)

    const button = screen.getByRole('button', { name: 'Entra' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('star-border')
  })

  it('non cambia un tipo dichiarato: submit resta submit', () => {
    render(<StarBorder type="submit">Entra</StarBorder>)

    expect(screen.getByRole('button', { name: 'Entra' })).toHaveAttribute('type', 'submit')
  })

  it('con as={Link} è un collegamento con il suo indirizzo', () => {
    render(
      <MemoryRouter>
        <StarBorder as={Link} to="/accesso">
          Accedi
        </StarBorder>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Accedi' })).toHaveAttribute('href', '/accesso')
  })

  it('passa disabled e la classe in più', () => {
    render(
      <StarBorder disabled className="rs-auth-submit">
        Entra
      </StarBorder>,
    )

    const button = screen.getByRole('button', { name: 'Entra' })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('star-border', 'rs-auth-submit')
  })

  it('imposta raggio e spessore come proprietà CSS', () => {
    render(
      <StarBorder radius={12} thickness={2}>
        Entra
      </StarBorder>,
    )

    const button = screen.getByRole('button', { name: 'Entra' })
    expect(button.style.getPropertyValue('--star-border-radius')).toBe('12px')
    expect(button.style.getPropertyValue('--star-border-thickness')).toBe('2px')
  })

  it('il canvas della luce è nascosto ai lettori di schermo', () => {
    const { container } = render(<StarBorder>Entra</StarBorder>)

    expect(container.querySelector('canvas.star-border__light')).toHaveAttribute('aria-hidden', 'true')
  })

  it('senza canvas (jsdom) non lancia errori e mostra comunque il testo', () => {
    expect(() => render(<StarBorder>Entra</StarBorder>)).not.toThrow()
    expect(screen.getByText('Entra')).toBeInTheDocument()
  })
})

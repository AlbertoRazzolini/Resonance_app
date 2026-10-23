import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Magnet from './Magnet'

// Effetto magnete (ReactBits): mostra i figli e li lascia usabili; lo spostamento vero lo prova il browser.
describe('Magnet', () => {
  it('mostra i figli dentro un involucro con le classi indicate', () => {
    render(
      <Magnet wrapperClassName="rs-magnet">
        <button type="button">Pubblica</button>
      </Magnet>,
    )

    const wrapper = screen.getByRole('button', { name: 'Pubblica' }).closest('.rs-magnet')
    expect(wrapper).not.toBeNull()
  })

  it('con disabled non sposta nulla: nessuna trasformazione sul contenuto', () => {
    render(
      <Magnet disabled>
        <button type="button">Pubblica</button>
      </Magnet>,
    )

    const inner = screen.getByRole('button', { name: 'Pubblica' }).parentElement as HTMLElement
    expect(inner.style.transform).toBe('')
  })

  it('si smonta senza lasciare errori', () => {
    const { unmount } = render(
      <Magnet>
        <button type="button">Pubblica</button>
      </Magnet>,
    )

    expect(() => unmount()).not.toThrow()
  })
})

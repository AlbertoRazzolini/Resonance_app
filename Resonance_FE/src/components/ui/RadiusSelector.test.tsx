import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RadiusSelector } from './RadiusSelector'

// Selettore del raggio: un pulsante per livello, quello attuale segnato, il clic dà il nuovo raggio in km.
describe('RadiusSelector', () => {
  it('ha un pulsante per ognuno dei cinque livelli, nell\'ordine', () => {
    render(<RadiusSelector value={15} onChange={() => {}} />)

    const labels = screen.getAllByRole('button').map((button) => button.textContent)
    expect(labels).toEqual(['5 km', '15 km', '25 km', '50 km', '100 km'])
  })

  it('segna come premuto solo il livello attuale', () => {
    render(<RadiusSelector value={25} onChange={() => {}} />)

    expect(screen.getByRole('button', { name: '25 km' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '15 km' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('il clic su un livello dà il nuovo raggio in km', async () => {
    const onChange = vi.fn()
    render(<RadiusSelector value={15} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: '50 km' }))

    expect(onChange).toHaveBeenCalledWith(50)
  })

  it('il gruppo ha il nome "Raggio" per i lettori di schermo', () => {
    render(<RadiusSelector value={15} onChange={() => {}} />)

    expect(screen.getByRole('group', { name: 'Raggio' })).toBeInTheDocument()
  })
})

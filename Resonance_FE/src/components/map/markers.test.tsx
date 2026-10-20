import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EventMarker, MarkerLegend } from './markers'

// Marker degli eventi: nome per i lettori di schermo con il tipo, uso da tastiera, tipo distinto anche senza colore.
describe('EventMarker', () => {
  it('ha come nome il titolo e il tipo dell\'evento', () => {
    render(<EventMarker kind="official" label="Soviet Soviet" onSelect={() => {}} />)

    expect(screen.getByRole('button', { name: 'Soviet Soviet (ufficiale)' })).toBeInTheDocument()
  })

  it('un indie event ha il tipo "indie" nel nome', () => {
    render(<EventMarker kind="indie" label="Gazebo Penguins" onSelect={() => {}} />)

    expect(screen.getByRole('button', { name: 'Gazebo Penguins (indie)' })).toBeInTheDocument()
  })

  it('si apre con il clic', async () => {
    const onSelect = vi.fn()
    render(<EventMarker kind="official" label="Mogwai" onSelect={onSelect} />)

    await userEvent.click(screen.getByRole('button'))

    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('si apre da tastiera con Invio e con la barra spaziatrice', async () => {
    const onSelect = vi.fn()
    render(<EventMarker kind="official" label="Mogwai" onSelect={onSelect} />)

    screen.getByRole('button').focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')

    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it('segna con aria-pressed il marker selezionato', () => {
    render(<EventMarker kind="indie" label="Gazebo" selected onSelect={() => {}} />)

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('concerti e indie hanno icone diverse, non solo un altro colore', () => {
    const { container: official } = render(
      <EventMarker kind="official" label="A" onSelect={() => {}} />,
    )
    const { container: indie } = render(<EventMarker kind="indie" label="B" onSelect={() => {}} />)

    expect(official.querySelector('svg path')?.getAttribute('d')).not.toBe(
      indie.querySelector('svg path')?.getAttribute('d'),
    )
  })
})

describe('MarkerLegend', () => {
  it('spiega i due tipi di marker con le stesse parole delle card', () => {
    render(<MarkerLegend />)

    expect(screen.getByText('Ufficiale')).toBeInTheDocument()
    expect(screen.getByText('Indie')).toBeInTheDocument()
  })
})

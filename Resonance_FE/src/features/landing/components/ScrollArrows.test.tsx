import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ScrollArrows } from './ScrollArrows'

// Frecce «scorri» della landing: un pulsante accessibile che porta alla schermata successiva.

describe('ScrollArrows', () => {
  it('è un pulsante con il nome «Scorri verso il basso» e il disegno è nascosto agli screen reader', () => {
    const { container } = render(<ScrollArrows onClick={() => {}} />)

    expect(screen.getByRole('button', { name: 'Scorri verso il basso' })).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('al clic chiede di passare alla schermata successiva', async () => {
    const onClick = vi.fn()
    render(<ScrollArrows onClick={onClick} />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Scorri verso il basso' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('più coppie di frecce nella stessa pagina non condividono lo stesso gradiente', () => {
    const { container } = render(
      <>
        <ScrollArrows onClick={() => {}} />
        <ScrollArrows onClick={() => {}} />
      </>,
    )

    const ids = Array.from(container.querySelectorAll('linearGradient')).map((node) => node.id)
    expect(new Set(ids).size).toBe(2)
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BackToTop } from './BackToTop'

// Pulsante «Torna all'inizio» dell'ultima schermata della landing: riporta alla prima schermata.

describe('BackToTop', () => {
  it("è un pulsante con il nome «Torna all'inizio» e il disegno è nascosto agli screen reader", () => {
    const { container } = render(<BackToTop onClick={() => {}} />)

    expect(screen.getByRole('button', { name: "Torna all'inizio" })).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('al clic chiede di tornare in cima', async () => {
    const onClick = vi.fn()
    render(<BackToTop onClick={onClick} />)

    await userEvent.setup().click(screen.getByRole('button', { name: "Torna all'inizio" }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from './Pagination'

// Numeri di pagina: la pagina corrente è segnata, i salti chiamano `onChange` con l'indice da 0 e con una sola pagina non
// si disegna niente.

describe('Pagination', () => {
  it('non disegna niente con una sola pagina', () => {
    const { container } = render(<Pagination page={0} totalPages={1} onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('segna la pagina corrente e spegne «Precedente» sulla prima', () => {
    render(<Pagination page={0} totalPages={3} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Pagina 1' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Pagina 2' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Precedente' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Successivo' })).toBeEnabled()
  })

  it('spegne «Successivo» sull ultima pagina', () => {
    render(<Pagination page={2} totalPages={3} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Successivo' })).toBeDisabled()
  })

  it('chiama onChange con l indice da 0 della pagina scelta', async () => {
    const onChange = vi.fn()
    render(<Pagination page={0} totalPages={4} onChange={onChange} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Pagina 3' }))
    await user.click(screen.getByRole('button', { name: 'Successivo' }))

    expect(onChange.mock.calls).toEqual([[2], [1]])
  })
})

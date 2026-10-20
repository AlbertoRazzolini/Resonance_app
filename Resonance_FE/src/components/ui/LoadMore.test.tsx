import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoadMore } from './LoadMore'

// "Carica altri" degli elenchi a pagine: si vede solo se c'è altro, si spegne mentre carica.
describe('LoadMore', () => {
  it('non mostra niente quando non c\'è altro da caricare', () => {
    render(<LoadMore hasMore={false} loading={false} onClick={() => {}} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('con altre pagine mostra "Carica altri" e il clic lo chiama', async () => {
    const onClick = vi.fn()
    render(<LoadMore hasMore loading={false} onClick={onClick} />)

    await userEvent.click(screen.getByRole('button', { name: 'Carica altri' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('mentre carica il pulsante è spento e segnato come occupato', () => {
    render(<LoadMore hasMore loading onClick={() => {}} />)

    const button = screen.getByRole('button', { name: 'Carica altri' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })
})

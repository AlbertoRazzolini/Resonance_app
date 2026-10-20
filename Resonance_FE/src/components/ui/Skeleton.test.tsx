import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Skeleton } from './Skeleton'

// Scheletro di caricamento: compare solo dopo circa 200 ms (i caricamenti veloci non lampeggiano) e dice ai lettori di
// schermo che la pagina sta caricando.
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Skeleton', () => {
  it('non mostra niente prima dei 200 ms', () => {
    render(<Skeleton>forma</Skeleton>)

    act(() => {
      vi.advanceTimersByTime(199)
    })

    expect(screen.queryByText('forma')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('dopo 200 ms mostra la forma, segnata come in caricamento, con il testo per i lettori di schermo', () => {
    render(<Skeleton>forma</Skeleton>)

    act(() => {
      vi.advanceTimersByTime(200)
    })

    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region).toHaveTextContent('Caricamento in corso')
    expect(screen.getByText('forma')).toBeInTheDocument()
  })

  it('se si smonta prima dei 200 ms non resta nessun timer acceso', () => {
    const { unmount } = render(<Skeleton>forma</Skeleton>)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})

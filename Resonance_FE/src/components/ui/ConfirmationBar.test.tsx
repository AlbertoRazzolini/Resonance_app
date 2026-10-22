import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import { confirmationShown } from '@/lib/notices/confirmationSlice'
import { ConfirmationBar } from './ConfirmationBar'

// Striscia di conferma in cima alla pagina: mostra il testo, sparisce da sola dopo 4 secondi e si può chiudere.
function renderBar() {
  const store = makeStore()
  render(
    <Provider store={store}>
      <ConfirmationBar />
    </Provider>,
  )
  return store
}

describe('ConfirmationBar', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
  afterEach(() => vi.useRealTimers())

  it('senza conferma non disegna niente', () => {
    renderBar()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('mostra il testo in una regione annunciata dai lettori di schermo', () => {
    const store = renderBar()
    act(() => {
      store.dispatch(confirmationShown('Amicizia accettata'))
    })

    expect(screen.getByRole('status')).toHaveTextContent('Amicizia accettata')
  })

  it('sparisce dopo 4 secondi, non prima', () => {
    const store = renderBar()
    act(() => {
      store.dispatch(confirmationShown('Richiesta inviata'))
    })

    act(() => vi.advanceTimersByTime(3999))
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('una conferma uguale alla precedente riparte da 4 secondi', () => {
    const store = renderBar()
    act(() => {
      store.dispatch(confirmationShown('Richiesta inviata'))
    })
    act(() => vi.advanceTimersByTime(3000))
    act(() => {
      store.dispatch(confirmationShown('Richiesta inviata'))
    })

    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('si chiude con il pulsante «Chiudi»', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    const store = renderBar()
    act(() => {
      store.dispatch(confirmationShown('Richiesta annullata'))
    })

    await user.click(screen.getByRole('button', { name: 'Chiudi' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

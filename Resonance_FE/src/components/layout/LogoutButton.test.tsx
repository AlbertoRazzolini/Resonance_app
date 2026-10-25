import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse } from '@/test/fixtures/users'
import { logoutSucceeds } from '@/test/handlers/auth'
import { server } from '@/test/server'
import { LogoutButton } from './LogoutButton'

// Pulsante «Esci» (colonna a sinistra e barra in alto): prima di chiudere la sessione una finestra chiede conferma
// (decisione dello studente, 25 ottobre); solo la conferma manda il DELETE del refresh token.
function renderButton() {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse()))
  render(
    <Provider store={store}>
      <MemoryRouter>
        <LogoutButton />
      </MemoryRouter>
    </Provider>,
  )
  return store
}

describe('LogoutButton', () => {
  it('«Esci» chiede conferma e non chiude la sessione finché non si conferma', async () => {
    const calls: Request[] = []
    server.use(logoutSucceeds(calls))
    const store = renderButton()

    await userEvent.click(screen.getByRole('button', { name: 'Esci' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Vuoi uscire?')
    expect(calls).toHaveLength(0)
    expect(store.getState().auth.status).toBe('authenticated')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Esci' }))

    await waitFor(() => expect(store.getState().auth.status).toBe('anonymous'))
    expect(calls).toHaveLength(1)
    expect(calls[0].headers.get('X-Requested-With')).toBe('XMLHttpRequest')
  })

  it('«Annulla» chiude la finestra e la sessione resta aperta', async () => {
    const calls: Request[] = []
    server.use(logoutSucceeds(calls))
    const store = renderButton()

    await userEvent.click(screen.getByRole('button', { name: 'Esci' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annulla' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toHaveLength(0)
    expect(store.getState().auth.status).toBe('authenticated')
  })
})

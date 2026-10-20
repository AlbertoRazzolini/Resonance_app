import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { ROUTES } from '@/app/routes'
import { sessionEnded, sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { logoutSucceeds } from '@/test/handlers/auth'
import { server } from '@/test/server'
import { UserMenu } from './UserMenu'

// Menu utente della barra: Accedi e Registrati per l'anonimo; per chi ha la sessione il cerchio con l'iniziale e, nel menu, Esci.
function renderMenu(displayName: string | null) {
  const store = makeStore()
  if (displayName) {
    store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ displayName }) })))
  } else {
    store.dispatch(sessionEnded())
  }
  render(
    <Provider store={store}>
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    </Provider>,
  )
  return store
}

describe('UserMenu', () => {
  it("per l'anonimo mostra Accedi e Registrati, senza il menu dell'account", () => {
    renderMenu(null)

    expect(screen.getByRole('link', { name: 'Accedi' })).toHaveAttribute('href', ROUTES.login)
    expect(screen.getByRole('link', { name: 'Registrati' })).toHaveAttribute(
      'href',
      ROUTES.register,
    )
    expect(screen.queryByRole('button', { name: /Menu dell'account/ })).not.toBeInTheDocument()
  })

  it("per chi ha la sessione mostra l'iniziale del nome in maiuscolo, non Accedi e Registrati", () => {
    renderMenu('mattia verdi')

    expect(
      screen.getByRole('button', { name: "Menu dell'account di mattia verdi" }),
    ).toHaveTextContent('M')
    expect(screen.queryByRole('link', { name: 'Accedi' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Registrati' })).not.toBeInTheDocument()
  })

  it('mostra il nome accanto al cerchio (lo nasconde il CSS sotto il desktop)', () => {
    renderMenu('mattia verdi')

    expect(screen.getByText('mattia verdi')).toHaveClass('rs-user__name')
  })

  it("con un nome che inizia con un'emoji mostra l'emoji intera, non un carattere spezzato", () => {
    renderMenu('🎸 Chitarrista')

    expect(screen.getByRole('button', { name: /Menu dell'account/ })).toHaveTextContent('🎸')
  })

  it('Esci chiude la sessione dopo il DELETE del refresh token', async () => {
    const calls: Request[] = []
    server.use(logoutSucceeds(calls))
    const store = renderMenu('Mattia')

    await userEvent.click(screen.getByRole('button', { name: /Menu dell'account/ }))
    await userEvent.click(await screen.findByText('Esci'))

    await waitFor(() => expect(store.getState().auth.status).toBe('anonymous'))
    expect(calls).toHaveLength(1)
    expect(calls[0].headers.get('X-Requested-With')).toBe('XMLHttpRequest')
  })
})

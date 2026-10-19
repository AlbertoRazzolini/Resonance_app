import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { ROUTES } from '@/app/routes'
import { sessionEnded, sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse } from '@/test/fixtures/users'
import { RedirectIfAuthenticated } from './RedirectIfAuthenticated'

// Le pagine di accesso non servono a chi è già dentro: va alla home, o alla pagina richiesta se è quella la strada fatta.
function renderAt(authenticated: boolean, state?: unknown) {
  const store = makeStore()
  if (authenticated) store.dispatch(sessionStarted(makeLoginResponse()))
  else store.dispatch(sessionEnded())
  const router = createMemoryRouter(
    [
      { path: ROUTES.home, element: <p>Home</p> },
      { path: '/riservata', element: <p>Pagina riservata</p> },
      {
        path: ROUTES.login,
        element: (
          <RedirectIfAuthenticated>
            <p>Pagina di accesso</p>
          </RedirectIfAuthenticated>
        ),
      },
    ],
    { initialEntries: [{ pathname: ROUTES.login, state }] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return { router, store }
}

describe('RedirectIfAuthenticated', () => {
  it("mostra la pagina all'anonimo", () => {
    renderAt(false)
    expect(screen.getByText('Pagina di accesso')).toBeInTheDocument()
  })

  it('manda alla home chi ha la sessione', () => {
    renderAt(true)
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('manda alla pagina richiesta (stato `from`) chi ha la sessione', () => {
    renderAt(true, { from: '/riservata' })
    expect(screen.getByText('Pagina riservata')).toBeInTheDocument()
  })

  it('ignora una pagina richiesta che non è un percorso interno (nessun reindirizzamento aperto)', () => {
    renderAt(true, { from: 'https://sito-esterno.example/trappola' })
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('ignora una pagina richiesta che inizia con due barre (indirizzo di un altro sito)', () => {
    renderAt(true, { from: '//sito-esterno.example/trappola' })
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('ignora uno stato che non ha la forma attesa', () => {
    renderAt(true, { from: 42 })
    expect(screen.getByText('Home')).toBeInTheDocument()
  })
})

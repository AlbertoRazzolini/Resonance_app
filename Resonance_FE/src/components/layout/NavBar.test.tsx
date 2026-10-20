import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { ROUTES } from '@/app/routes'
import { sessionEnded, sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { NavBar } from './NavBar'

// Barra in alto: il logo porta agli eventi (e si toglie sul desktop, dove sta nella colonna), il titolo lo dichiara la
// rotta, la campanella (disattivata fino a FE-09b) c'è solo con la sessione e non esiste il menu a scomparsa
// (decisione 83). Serve un router a dati: il titolo si legge da `useMatches`.
function renderNavBar(
  loggedIn: boolean,
  { showLogo = true, title }: { showLogo?: boolean; title?: string } = {},
) {
  const store = makeStore()
  store.dispatch(loggedIn ? sessionStarted(makeLoginResponse({ user: makeMe() })) : sessionEnded())
  const router = createMemoryRouter([
    { path: '/', element: <NavBar showLogo={showLogo} />, handle: title ? { title } : undefined },
  ])
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('NavBar', () => {
  it('il logo porta agli eventi', () => {
    renderNavBar(false)

    expect(screen.getByRole('link', { name: 'Resonance' })).toHaveAttribute('href', ROUTES.events)
  })

  it('senza il logo (desktop) non mostra il collegamento al marchio', () => {
    renderNavBar(false, { showLogo: false })

    expect(screen.queryByRole('link', { name: 'Resonance' })).not.toBeInTheDocument()
  })

  it('mostra il titolo che la rotta dichiara in handle.title', () => {
    renderNavBar(false, { title: 'Eventi' })

    expect(screen.getByText('Eventi')).toBeInTheDocument()
  })

  it('senza titolo dichiarato dalla rotta non mostra nessun titolo', () => {
    renderNavBar(false)

    expect(document.querySelector('.rs-topbar__title')).toBeNull()
  })

  it("per chi ha la sessione mostra la campanella, disattivata e con il nome 'Notifiche'", () => {
    renderNavBar(true)

    expect(screen.getByRole('button', { name: 'Notifiche' })).toBeDisabled()
  })

  it("per l'anonimo non mostra la campanella ma Accedi e Registrati", () => {
    renderNavBar(false)

    expect(screen.queryByRole('button', { name: 'Notifiche' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Accedi' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrati' })).toBeInTheDocument()
  })

  it('non ha il pulsante del menu a scomparsa', () => {
    renderNavBar(true)

    expect(screen.queryByRole('button', { name: 'Apri il menu' })).not.toBeInTheDocument()
  })
})

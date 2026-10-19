import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { ROUTES } from '@/app/routes'
import { sessionEnded, sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import type { Role } from '@/types/users'
import { RequireAuth } from './RequireAuth'
import { RequireRole } from './RequireRole'

// Protezioni di interfaccia: RequireAuth rimanda al login ricordando la pagina, RequireRole mostra "Accesso negato"
// a chi non ha il ruolo (la protezione vera è nel backend).
function LoginProbe() {
  const location = useLocation()
  return <p>Login (da {(location.state as { from?: string } | null)?.from ?? 'nessuna'})</p>
}

function renderAt(path: string, roles: Role[] | null) {
  const store = makeStore()
  if (roles) store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ roles }) })))
  else store.dispatch(sessionEnded())
  const router = createMemoryRouter(
    [
      { path: ROUTES.home, element: <p>Home</p> },
      { path: ROUTES.login, element: <LoginProbe /> },
      {
        path: '/riservata',
        element: (
          <RequireAuth>
            <p>Pagina riservata</p>
          </RequireAuth>
        ),
      },
      {
        path: '/admin',
        element: (
          <RequireRole roles={['ADMIN']}>
            <p>Area admin</p>
          </RequireRole>
        ),
      },
      {
        path: '/musica',
        element: (
          <RequireRole roles={['MUSICIAN', 'HOST']}>
            <p>Area musica</p>
          </RequireRole>
        ),
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return router
}

describe('RequireAuth', () => {
  it('mostra la pagina a chi ha la sessione', () => {
    renderAt('/riservata', ['FAN'])
    expect(screen.getByText('Pagina riservata')).toBeInTheDocument()
  })

  it("rimanda l'anonimo al login ricordando la pagina richiesta", () => {
    renderAt('/riservata?x=1', null)
    expect(screen.getByText('Login (da /riservata?x=1)')).toBeInTheDocument()
  })
})

describe('RequireRole', () => {
  it('a un FAN mostra "Accesso negato" allo stesso indirizzo, senza nominare ruoli', () => {
    const router = renderAt('/admin', ['FAN'])
    expect(screen.queryByText('Area admin')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Accesso negato' })).toBeInTheDocument()
    expect(screen.getByText('Non hai i permessi per accedere a questa pagina.')).toBeInTheDocument()
    expect(screen.queryByText(/admin/i)).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin')
    expect(screen.getByRole('link', { name: 'Torna alla home' })).toHaveAttribute('href', '/')
  })

  it('mostra la rotta admin a un ADMIN e a un SUPERADMIN', () => {
    renderAt('/admin', ['ADMIN'])
    expect(screen.getByText('Area admin')).toBeInTheDocument()
  })

  it('il SUPERADMIN vale come ADMIN', () => {
    renderAt('/admin', ['SUPERADMIN'])
    expect(screen.getByText('Area admin')).toBeInTheDocument()
  })

  it('con più ruoli ammessi basta averne uno', () => {
    renderAt('/musica', ['FAN', 'HOST'])
    expect(screen.getByText('Area musica')).toBeInTheDocument()
  })

  it("l'anonimo che apre una rotta di ruolo va al login, non alla home", () => {
    renderAt('/admin', null)
    expect(screen.getByText('Login (da /admin)')).toBeInTheDocument()
  })
})

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
import type { MeResponse, Role } from '@/types/users'
import { UserMenu } from './UserMenu'

// Menu utente della barra: Accedi e Registrati per l'anonimo; per chi ha la sessione il cerchio con la foto o l'iniziale
// e, nel menu, le voci «Pubblica» secondo i ruoli ed Esci.
function renderMenu(displayName: string | null, overrides: Partial<MeResponse> = {}) {
  const store = makeStore()
  if (displayName) {
    store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ displayName, ...overrides }) })))
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

  it("con una foto nel profilo mostra la foto al posto dell'iniziale", () => {
    renderMenu('Mattia', { avatarUrl: 'https://x.it/a.png' })

    const toggle = screen.getByRole('button', { name: /Menu dell'account/ })
    expect(toggle.querySelector('img')).toHaveAttribute('src', 'https://x.it/a.png')
  })

  it('a un FAN non mostra nessuna voce «Pubblica»', async () => {
    renderMenu('Mattia', { roles: ['FAN'] })

    await userEvent.click(screen.getByRole('button', { name: /Menu dell'account/ }))

    expect(await screen.findByText('Esci')).toBeInTheDocument()
    expect(screen.queryByText('Pubblica concerto')).not.toBeInTheDocument()
    expect(screen.queryByText('Pubblica indie event')).not.toBeInTheDocument()
  })

  it('a un HOST mostra «Pubblica concerto» e non «Pubblica indie event»', async () => {
    renderMenu('Mattia', { roles: ['FAN', 'HOST'] })

    await userEvent.click(screen.getByRole('button', { name: /Menu dell'account/ }))

    expect(await screen.findByRole('link', { name: 'Pubblica concerto' })).toHaveAttribute(
      'href',
      ROUTES.newConcert,
    )
    expect(screen.queryByText('Pubblica indie event')).not.toBeInTheDocument()
  })

  it('a un MUSICIAN mostra «Pubblica indie event» e non «Pubblica concerto»', async () => {
    renderMenu('Mattia', { roles: ['FAN', 'MUSICIAN'] })

    await userEvent.click(screen.getByRole('button', { name: /Menu dell'account/ }))

    expect(await screen.findByRole('link', { name: 'Pubblica indie event' })).toHaveAttribute(
      'href',
      ROUTES.newIndieEvent,
    )
    expect(screen.queryByText('Pubblica concerto')).not.toBeInTheDocument()
  })

  it('con entrambi i ruoli mostra tutte e due le voci, prima di Esci', async () => {
    renderMenu('Mattia', { roles: ['FAN', 'MUSICIAN', 'HOST'] })

    await userEvent.click(screen.getByRole('button', { name: /Menu dell'account/ }))

    await screen.findByText('Esci')
    const items = [...document.querySelectorAll('.dropdown-item')].map((item) => item.textContent)
    expect(items).toEqual(['Amici', 'Pubblica concerto', 'Pubblica indie event', 'Esci'])
  })

  it.each([[['FAN']], [['FAN', 'MUSICIAN', 'HOST']]] as [Role[]][])(
    'a chi ha i ruoli %s non mostra le voci dell’area admin',
    async (roles) => {
      renderMenu('Mattia', { roles })

      await userEvent.click(screen.getByRole('button', { name: /Menu dell'account/ }))

      await screen.findByText('Esci')
      expect(screen.queryByText('Utenti')).not.toBeInTheDocument()
      expect(screen.queryByText('Contenuti nascosti')).not.toBeInTheDocument()
    },
  )

  it.each([['ADMIN'], ['SUPERADMIN']] as [Role][])(
    'a un %s mostra «Utenti» e «Contenuti nascosti», con i loro collegamenti, prima di Esci',
    async (role) => {
      renderMenu('Mattia', { roles: ['FAN', role] })

      await userEvent.click(screen.getByRole('button', { name: /Menu dell'account/ }))

      expect(await screen.findByRole('link', { name: 'Utenti' })).toHaveAttribute('href', ROUTES.adminUsers)
      expect(screen.getByRole('link', { name: 'Contenuti nascosti' })).toHaveAttribute('href', ROUTES.adminContent)
      const items = [...document.querySelectorAll('.dropdown-item')].map((item) => item.textContent)
      expect(items).toEqual(['Amici', 'Utenti', 'Contenuti nascosti', 'Esci'])
    },
  )

  it('a tutti i ruoli mostra «Amici», che porta all’elenco degli amici', async () => {
    renderMenu('Mattia', { roles: ['FAN'] })

    await userEvent.click(screen.getByRole('button', { name: /Menu dell'account/ }))

    expect(await screen.findByRole('link', { name: 'Amici' })).toHaveAttribute('href', ROUTES.friends)
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

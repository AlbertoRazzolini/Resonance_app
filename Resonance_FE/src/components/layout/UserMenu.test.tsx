import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { ROUTES } from '@/app/routes'
import { sessionEnded, sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { setViewportWidth } from '@/test/viewport'
import type { MeResponse, Role } from '@/types/users'
import { UserMenu } from './UserMenu'

// Menu utente della barra: Accedi e Registrati per l'anonimo; per chi ha la sessione il cerchio con la foto o l'iniziale
// e, nel menu, le voci «Pubblica» secondo i ruoli (e l'area admin sul telefono). «Esci» non è qui (ha il suo pulsante, vedi
// LogoutButton) e «Amici» sta nella navigazione. Senza voci da mostrare il cerchio è un collegamento al Profilo.
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
    // «Accedi» ha il bordo animato (FE-12, decisione 107)
    expect(screen.getByRole('link', { name: 'Accedi' })).toHaveClass('star-border')
    expect(screen.getByRole('link', { name: 'Registrati' })).toHaveAttribute(
      'href',
      ROUTES.register,
    )
    expect(screen.queryByRole('button', { name: /Menu dell'account/ })).not.toBeInTheDocument()
  })

  it("per chi ha la sessione mostra l'iniziale del nome in maiuscolo, non Accedi e Registrati", () => {
    renderMenu('mattia verdi', { roles: ['FAN', 'HOST'] })

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
    renderMenu('🎸 Chitarrista', { roles: ['FAN', 'HOST'] })

    expect(screen.getByRole('button', { name: /Menu dell'account/ })).toHaveTextContent('🎸')
  })

  it("con una foto nel profilo mostra la foto al posto dell'iniziale", () => {
    renderMenu('Mattia', { roles: ['FAN', 'HOST'], avatarUrl: 'https://x.it/a.png' })

    const toggle = screen.getByRole('button', { name: /Menu dell'account/ })
    expect(toggle.querySelector('img')).toHaveAttribute('src', 'https://x.it/a.png')
  })

  // Senza voci da mostrare un menu sarebbe vuoto: il cerchio porta direttamente al Profilo (25 ottobre)
  it.each([[375], [768], [1280]])('a %s px un FAN non ha il menu: il cerchio è un collegamento al Profilo', (width) => {
    setViewportWidth(width)
    renderMenu('Mattia', { roles: ['FAN'] })

    expect(screen.getByRole('link', { name: 'Profilo di Mattia' })).toHaveAttribute('href', ROUTES.profile)
    expect(screen.queryByRole('button', { name: /Menu dell'account/ })).not.toBeInTheDocument()
  })

  it.each([[768], [1280]])('a %s px anche un admin senza altri ruoli ha il collegamento al Profilo: le voci admin sono nella colonna', (width) => {
    setViewportWidth(width)
    renderMenu('Mattia', { roles: ['FAN', 'ADMIN'] })

    expect(screen.getByRole('link', { name: 'Profilo di Mattia' })).toHaveAttribute('href', ROUTES.profile)
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

  it('con entrambi i ruoli mostra tutte e due le voci e nessun «Esci»', async () => {
    renderMenu('Mattia', { roles: ['FAN', 'MUSICIAN', 'HOST'] })

    await userEvent.click(screen.getByRole('button', { name: /Menu dell'account/ }))

    await screen.findByText('Pubblica concerto')
    const items = [...document.querySelectorAll('.dropdown-item')].map((item) => item.textContent)
    expect(items).toEqual(['Pubblica concerto', 'Pubblica indie event'])
  })

  it('a chi è HOST e MUSICIAN senza ruolo admin non mostra le voci dell’area admin', async () => {
    renderMenu('Mattia', { roles: ['FAN', 'MUSICIAN', 'HOST'] })

    await userEvent.click(screen.getByRole('button', { name: /Menu dell'account/ }))

    await screen.findByText('Pubblica concerto')
    expect(screen.queryByText('Utenti')).not.toBeInTheDocument()
    expect(screen.queryByText('Contenuti nascosti')).not.toBeInTheDocument()
  })

  // Sul telefono non c'è la colonna a sinistra: l'area admin sta qui. Da 768 px la colonna ha «Utenti» e «Nascosti» e nel menu
  // sarebbero ridondanti (scelta dello studente, FE-10).
  it.each([['ADMIN'], ['SUPERADMIN']] as [Role][])(
    'sul telefono a un %s mostra «Utenti» e «Contenuti nascosti», con i loro collegamenti',
    async (role) => {
      setViewportWidth(375)
      renderMenu('Mattia', { roles: ['FAN', role] })

      await userEvent.click(screen.getByRole('button', { name: /Menu dell'account/ }))

      expect(await screen.findByRole('link', { name: 'Utenti' })).toHaveAttribute('href', ROUTES.adminUsers)
      expect(screen.getByRole('link', { name: 'Contenuti nascosti' })).toHaveAttribute('href', ROUTES.adminContent)
      const items = [...document.querySelectorAll('.dropdown-item')].map((item) => item.textContent)
      expect(items).toEqual(['Utenti', 'Contenuti nascosti'])
    },
  )

  it('sul telefono a un admin che è anche HOST separa «Pubblica» dall’area admin con un filo', async () => {
    setViewportWidth(375)
    renderMenu('Mattia', { roles: ['FAN', 'HOST', 'ADMIN'] })

    await userEvent.click(screen.getByRole('button', { name: /Menu dell'account/ }))

    await screen.findByText('Utenti')
    const items = [...document.querySelectorAll('.dropdown-item')].map((item) => item.textContent)
    expect(items).toEqual(['Pubblica concerto', 'Utenti', 'Contenuti nascosti'])
    expect(document.querySelectorAll('.dropdown-divider')).toHaveLength(1)
  })

  it('il menu non ha «Esci» né «Amici» a nessuna larghezza', async () => {
    renderMenu('Mattia', { roles: ['FAN', 'HOST'] })

    await userEvent.click(screen.getByRole('button', { name: /Menu dell'account/ }))

    await screen.findByText('Pubblica concerto')
    expect(screen.queryByText('Esci')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Amici' })).not.toBeInTheDocument()
  })
})

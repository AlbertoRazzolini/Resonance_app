import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { ROUTES } from '@/app/routes'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import type { Role } from '@/types/users'
import { SideNav } from './SideNav'

// Colonna a sinistra (da 768 px): le stesse sei voci delle tab; il logo solo se `showLogo` (desktop, dove la
// barra in alto non lo ha più). Per ADMIN e SUPERADMIN, dopo Profilo, «Utenti» e «Nascosti» dell'area di moderazione.
function renderSideNav(path: string, showLogo: boolean, roles?: Role[]) {
  const store = makeStore()
  if (roles) store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ roles }) })))
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <SideNav showLogo={showLogo} />
      </MemoryRouter>
    </Provider>,
  )
}

describe('SideNav', () => {
  it('mostra le sei voci con i percorsi delle tab', () => {
    renderSideNav(ROUTES.events, false)

    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      'Eventi',
      'Collab',
      'Feed',
      'Messaggi',
      'Profilo',
      'Amici',
    ])
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      ROUTES.events,
      ROUTES.collab,
      ROUTES.feed,
      ROUTES.chat,
      ROUTES.profile,
      ROUTES.friends,
    ])
  })

  it.each([['ADMIN'], ['SUPERADMIN']] as [Role][])(
    'a un %s aggiunge «Utenti» e «Nascosti» dopo Amici, con i percorsi dell’area admin',
    (role) => {
      renderSideNav(ROUTES.events, false, ['FAN', role])

      const links = screen.getAllByRole('link')
      expect(links.map((link) => link.textContent)).toEqual([
        'Eventi',
        'Collab',
        'Feed',
        'Messaggi',
        'Profilo',
        'Amici',
        'Utenti',
        'Nascosti',
      ])
      expect(links.slice(6).map((link) => link.getAttribute('href'))).toEqual([
        ROUTES.adminUsers,
        ROUTES.adminContent,
      ])
    },
  )

  it.each([['ADMIN'], ['SUPERADMIN']] as [Role][])(
    'a un %s racchiude «Utenti» e «Nascosti» in una schedina «ADMIN», senza le sei voci principali',
    (role) => {
      renderSideNav(ROUTES.events, false, ['FAN', role])

      const group = screen.getByRole('group', { name: 'Area admin' })
      expect(within(group).getAllByRole('link').map((link) => link.textContent)).toEqual(['Utenti', 'Nascosti'])
      expect(within(group).getByText('ADMIN')).toBeInTheDocument()
      expect(within(group).queryByRole('link', { name: 'Eventi' })).not.toBeInTheDocument()
      expect(within(group).queryByRole('link', { name: 'Profilo' })).not.toBeInTheDocument()
    },
  )

  it.each([[['FAN']], [['FAN', 'MUSICIAN', 'HOST']]] as [Role[]][])(
    'a chi ha i ruoli %s non mostra la schedina admin',
    (roles) => {
      renderSideNav(ROUTES.events, false, roles)

      expect(screen.queryByRole('group', { name: 'Area admin' })).not.toBeInTheDocument()
      expect(screen.queryByText('ADMIN')).not.toBeInTheDocument()
    },
  )

  it.each([[['FAN']], [['FAN', 'MUSICIAN', 'HOST']]] as [Role[]][])(
    'a chi ha i ruoli %s non mostra le voci dell’area admin',
    (roles) => {
      renderSideNav(ROUTES.events, false, roles)

      expect(screen.getAllByRole('link')).toHaveLength(6)
      expect(screen.queryByRole('link', { name: 'Utenti' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Nascosti' })).not.toBeInTheDocument()
    },
  )

  it('segna come corrente la voce admin della pagina aperta', () => {
    renderSideNav(ROUTES.adminContent, false, ['FAN', 'ADMIN'])

    expect(screen.getByRole('link', { name: 'Nascosti' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Utenti' })).not.toHaveAttribute('aria-current')
  })

  it('segna come corrente la voce della pagina aperta, anche su una sottopagina', () => {
    renderSideNav('/chat/42', false)

    expect(screen.getByRole('link', { name: 'Messaggi' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Eventi' })).not.toHaveAttribute('aria-current')
  })

  it('con showLogo mostra il marchio, che porta agli eventi', () => {
    renderSideNav(ROUTES.events, true)

    expect(screen.getByRole('link', { name: 'Resonance' })).toHaveAttribute('href', ROUTES.events)
  })

  it('senza showLogo non mostra il marchio', () => {
    renderSideNav(ROUTES.events, false)

    expect(screen.queryByRole('link', { name: 'Resonance' })).not.toBeInTheDocument()
  })

  it('ha un nome per i lettori di schermo', () => {
    renderSideNav(ROUTES.events, false)

    expect(screen.getByRole('navigation', { name: 'Navigazione principale' })).toBeInTheDocument()
  })

  it("l'animazione dell'icona parte con il mouse sulla scritta, non solo sull'icona", async () => {
    const user = userEvent.setup()
    renderSideNav(ROUTES.feed, false)
    const link = screen.getByRole('link', { name: 'Eventi' })
    const iconStyles = () => [...link.querySelectorAll('svg *')].map((node) => node.getAttribute('style') ?? '').join('|')
    const before = iconStyles()

    // La scritta, fuori dall'icona di 22 px: il mouse qui deve già far partire l'animazione
    await user.hover(link.querySelector('span')!)

    await waitFor(() => expect(iconStyles()).not.toBe(before))
  })

  it("l'animazione dell'icona parte anche al tocco, per i tablet senza cursore (FE-20)", async () => {
    const user = userEvent.setup()
    renderSideNav(ROUTES.feed, false)
    const link = screen.getByRole('link', { name: 'Eventi' })
    const iconStyles = () => [...link.querySelectorAll('svg *')].map((node) => node.getAttribute('style') ?? '').join('|')
    const before = iconStyles()

    // Dito premuto sulla scritta, senza rilasciare per non cambiare pagina: un tocco non fa mai scattare l'hover
    await user.pointer({ keys: '[TouchA>]', target: link.querySelector('span')! })

    await waitFor(() => expect(iconStyles()).not.toBe(before))
  })

  // «Esci» sta in fondo alla colonna, dopo tutte le voci (decisione dello studente, 25 ottobre); l'anonimo non lo vede
  it('con la sessione ha «Esci» in fondo alla colonna, dopo le voci', () => {
    renderSideNav(ROUTES.events, false, ['FAN'])

    const side = screen.getByRole('complementary')
    const logout = within(side).getByRole('button', { name: 'Esci' })
    expect(side.lastElementChild).toContainElement(logout)
  })

  it('senza sessione non ha «Esci»', () => {
    renderSideNav(ROUTES.events, false)

    expect(screen.queryByRole('button', { name: 'Esci' })).not.toBeInTheDocument()
  })
})

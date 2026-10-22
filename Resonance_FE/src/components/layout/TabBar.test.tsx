import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { ROUTES } from '@/app/routes'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { TabBar } from './TabBar'

// Barra di tab del telefono: le cinque voci con i loro percorsi e la voce attiva segnata per i lettori di schermo.
function renderTabBar(path: string) {
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={[path]}>
        <TabBar />
      </MemoryRouter>
    </Provider>,
  )
}

describe('TabBar', () => {
  it('anche per un admin resta a cinque voci: sul telefono l’area admin sta nel menu utente', () => {
    const store = makeStore()
    store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ roles: ['FAN', 'SUPERADMIN'] }) })))
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[ROUTES.events]}>
          <TabBar />
        </MemoryRouter>
      </Provider>,
    )

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Eventi',
      'Collab',
      'Feed',
      'Messaggi',
      'Profilo',
    ])
  })

  it("mostra le cinque voci, nell'ordine del prototipo, ciascuna col suo percorso", () => {
    renderTabBar(ROUTES.events)

    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      'Eventi',
      'Collab',
      'Feed',
      'Messaggi',
      'Profilo',
    ])
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      ROUTES.events,
      ROUTES.collab,
      ROUTES.feed,
      ROUTES.chat,
      ROUTES.profile,
    ])
  })

  it('segna come corrente solo la voce della pagina aperta', () => {
    renderTabBar(ROUTES.collab)

    expect(screen.getByRole('link', { name: 'Collab' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Eventi' })).not.toHaveAttribute('aria-current')
  })

  it('tiene attiva la voce anche su una sottopagina (la chat di una conversazione)', () => {
    renderTabBar('/chat/42')

    expect(screen.getByRole('link', { name: 'Messaggi' })).toHaveAttribute('aria-current', 'page')
  })

  it('sta dentro una navigazione con un nome per i lettori di schermo', () => {
    renderTabBar(ROUTES.events)

    expect(screen.getByRole('navigation', { name: 'Navigazione principale' })).toBeInTheDocument()
  })

  it("l'animazione dell'icona parte toccando la scritta, non solo l'icona", async () => {
    const user = userEvent.setup()
    renderTabBar(ROUTES.feed)
    const link = screen.getByRole('link', { name: 'Eventi' })
    const iconStyles = () => [...link.querySelectorAll('svg *')].map((node) => node.getAttribute('style') ?? '').join('|')
    const before = iconStyles()

    // Si preme sulla scritta senza rilasciare, per non cambiare pagina: l'icona deve già animarsi
    await user.pointer({ keys: '[MouseLeft>]', target: link.querySelector('span')! })

    await waitFor(() => expect(iconStyles()).not.toBe(before))
  })
})

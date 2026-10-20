import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { ROUTES } from '@/app/routes'
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
})

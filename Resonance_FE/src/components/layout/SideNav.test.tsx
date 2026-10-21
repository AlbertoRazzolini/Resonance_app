import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { ROUTES } from '@/app/routes'
import { SideNav } from './SideNav'

// Colonna a sinistra (da 768 px): le stesse cinque voci delle tab; il logo solo se `showLogo` (desktop, dove la
// barra in alto non lo ha più).
function renderSideNav(path: string, showLogo: boolean) {
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={[path]}>
        <SideNav showLogo={showLogo} />
      </MemoryRouter>
    </Provider>,
  )
}

describe('SideNav', () => {
  it('mostra le cinque voci con i percorsi delle tab', () => {
    renderSideNav(ROUTES.events, false)

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
})

import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from '@/app/router'
import { makeStore } from '@/app/store'
import { ROUTES } from '@/app/routes'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeConversation } from '@/test/fixtures/chat'
import { makePage } from '@/test/fixtures/events'
import { makeLoginResponse } from '@/test/fixtures/users'
import { conversationsFound, messagesFound } from '@/test/handlers/chat'
import { nearbyConcertsFound } from '@/test/handlers/events'
import { server } from '@/test/server'
import { setViewportWidth } from '@/test/viewport'

// Forma della navigazione ai tre breakpoint (decisione 83): tab sotto 768 px, colonna stretta da 768 px, colonna larga
// con il logo da 1200 px; mai due navigazioni insieme e mai un menu a scomparsa.
function renderEvents(width: number) {
  setViewportWidth(width)
  // La pagina Eventi cerca i concerti vicini all'apertura: senza handler la richiesta farebbe fallire il test
  server.use(nearbyConcertsFound([makePage([])]))
  render(
    <Provider store={makeStore()}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [ROUTES.events] })} />
    </Provider>,
  )
}

const navigation = () => screen.findAllByRole('navigation', { name: 'Navigazione principale' })

describe('AppShell', () => {
  it('sul telefono (375 px) ha le tab e non la colonna', async () => {
    renderEvents(375)

    expect(await navigation()).toHaveLength(1)
    expect(document.querySelector('.rs-tabbar')).not.toBeNull()
    expect(document.querySelector('.rs-sidenav')).toBeNull()
  })

  it('sul tablet (768 px) ha la colonna e non le tab; il logo sta nella barra in alto', async () => {
    renderEvents(768)

    expect(await navigation()).toHaveLength(1)
    expect(document.querySelector('.rs-sidenav')).not.toBeNull()
    expect(document.querySelector('.rs-tabbar')).toBeNull()
    expect(screen.getAllByRole('link', { name: 'Resonance' })).toHaveLength(1)
    expect(document.querySelector('.rs-topbar')).toContainElement(
      screen.getByRole('link', { name: 'Resonance' }),
    )
  })

  it('sul desktop (1280 px) ha la colonna con il logo e la barra in alto senza logo', async () => {
    renderEvents(1280)

    expect(await navigation()).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: 'Resonance' })).toHaveLength(1)
    expect(document.querySelector('.rs-sidenav')).toContainElement(
      screen.getByRole('link', { name: 'Resonance' }),
    )
  })

  it.each([375, 768, 1280])('a %s px ha il footer a comparsa con le informative', async (width) => {
    renderEvents(width)

    await navigation()
    expect(screen.getByRole('link', { name: 'Informativa privacy', hidden: true })).toHaveAttribute(
      'href',
      ROUTES.privacy,
    )
  })

  it.each([375, 768, 1280])("a %s px non c'è il menu a scomparsa", async (width) => {
    renderEvents(width)

    await navigation()
    expect(screen.queryByRole('button', { name: 'Apri il menu' })).not.toBeInTheDocument()
  })
})

// Dentro una conversazione, sul telefono, la barra di tab si nasconde: più spazio ai messaggi e la casella di scrittura
// sta fissa in fondo (scelta dello studente, FE-09b). Altrove e sugli schermi più larghi la navigazione resta.
function renderChat(path: string, width: number) {
  setViewportWidth(width)
  server.use(
    conversationsFound([makeConversation({ id: 'conv-1', unreadCount: 0 })]),
    messagesFound('conv-1', [{ messages: [], hasMore: false }]),
  )
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse()))
  render(
    <Provider store={store}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </Provider>,
  )
}

describe('AppShell · conversazione', () => {
  it('sul telefono dentro una conversazione non ha le tab', async () => {
    renderChat('/chat/conv-1', 375)

    expect(await screen.findByRole('region', { name: 'Conversazione con Giulia Rossi' })).toBeInTheDocument()
    expect(document.querySelector('.rs-tabbar')).toBeNull()
  })

  it('sul telefono nell’elenco delle conversazioni le tab ci sono', async () => {
    renderChat('/chat', 375)

    expect(await screen.findByRole('link', { name: 'Giulia Rossi' })).toBeInTheDocument()
    expect(document.querySelector('.rs-tabbar')).not.toBeNull()
  })

  // Il footer a comparsa salirebbe sopra la casella di scrittura (la pagina non scorre): dentro una conversazione non c'è
  it.each([375, 768, 1280])('a %s px dentro una conversazione non c’è il footer', async (width) => {
    renderChat('/chat/conv-1', width)

    await screen.findByRole('region', { name: 'Conversazione con Giulia Rossi' })
    expect(screen.queryByRole('link', { name: 'Informativa privacy', hidden: true })).not.toBeInTheDocument()
  })

  it.each([375, 768, 1280])('a %s px nell’elenco delle conversazioni il footer c’è', async (width) => {
    renderChat('/chat', width)

    await screen.findByRole('link', { name: 'Giulia Rossi' })
    expect(screen.getByRole('link', { name: 'Informativa privacy', hidden: true })).toBeInTheDocument()
  })

  it.each([768, 1280])('a %s px dentro una conversazione la colonna di navigazione resta', async (width) => {
    renderChat('/chat/conv-1', width)

    expect(await screen.findByRole('region', { name: 'Conversazione con Giulia Rossi' })).toBeInTheDocument()
    expect(document.querySelector('.rs-sidenav')).not.toBeNull()
  })
})

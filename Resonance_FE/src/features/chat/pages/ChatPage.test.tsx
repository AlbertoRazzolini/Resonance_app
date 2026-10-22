import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeConversation } from '@/test/fixtures/chat'
import { makeLoginResponse } from '@/test/fixtures/users'
import { conversationsFound, messagesFound } from '@/test/handlers/chat'
import { server } from '@/test/server'
import { setViewportWidth } from '@/test/viewport'
import { Component as ChatPage } from './ChatPage'

// Impaginazione di Messaggi: da 1200 px elenco e conversazione affiancati; su telefono e tablet un pannello alla volta.
function renderAt(path: string) {
  server.use(
    conversationsFound([makeConversation({ id: 'conv-1', unreadCount: 0 })]),
    messagesFound('conv-1', [{ messages: [], hasMore: false }]),
  )
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse()))
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={ROUTES.chatPage} element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

const list = () => screen.queryByRole('region', { name: 'Conversazioni' })
const conversation = () => screen.queryByRole('region', { name: 'Conversazione con Giulia Rossi' })

describe('ChatPage · desktop (1280 px)', () => {
  it('senza conversazione scelta mostra l’elenco e «Scegli una conversazione»', async () => {
    renderAt('/chat')
    expect(await screen.findByRole('link', { name: 'Giulia Rossi' })).toBeInTheDocument()
    expect(list()).toBeInTheDocument()
    expect(screen.getByText('Scegli una conversazione')).toBeInTheDocument()
  })

  it('con una conversazione aperta mostra elenco e conversazione affiancati', async () => {
    renderAt('/chat/conv-1')
    expect(await screen.findByRole('region', { name: 'Conversazione con Giulia Rossi' })).toBeInTheDocument()
    expect(list()).toBeInTheDocument()
    expect(screen.queryByText('Scegli una conversazione')).not.toBeInTheDocument()
  })
})

describe.each([
  ['telefono', 375],
  ['tablet', 768],
])('ChatPage · %s (%i px)', (_name, width) => {
  it('su /chat mostra solo l’elenco', async () => {
    setViewportWidth(width)
    renderAt('/chat')
    expect(await screen.findByRole('link', { name: 'Giulia Rossi' })).toBeInTheDocument()
    expect(conversation()).not.toBeInTheDocument()
    expect(screen.queryByText('Scegli una conversazione')).not.toBeInTheDocument()
  })

  it('su /chat/:id mostra solo la conversazione, con la freccia per tornare all’elenco', async () => {
    setViewportWidth(width)
    renderAt('/chat/conv-1')
    expect(await screen.findByRole('region', { name: 'Conversazione con Giulia Rossi' })).toBeInTheDocument()
    expect(list()).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Torna alle conversazioni' })).toHaveAttribute('href', '/chat')
  })
})

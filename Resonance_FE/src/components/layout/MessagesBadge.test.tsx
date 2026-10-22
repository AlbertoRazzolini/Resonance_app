import { act, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { receiveMessage } from '@/features/chat/api/chatApi'
import { makeConversation, makeMessage } from '@/test/fixtures/chat'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { conversationsFound } from '@/test/handlers/chat'
import { server } from '@/test/server'
import type { ConversationResponse } from '@/types/chat'
import { MessagesBadge } from './MessagesBadge'

// Badge sull'icona Messaggi: la somma degli unreadCount, da 1 a «9+», aggiornata a ogni messaggio in arrivo; per chi
// non ha la sessione non parte nessuna richiesta.
function renderBadge(conversations: ConversationResponse[], loggedIn = true) {
  const calls: Request[] = []
  server.use(conversationsFound(conversations, calls))
  const store = makeStore()
  if (loggedIn) store.dispatch(sessionStarted(makeLoginResponse()))
  render(
    <Provider store={store}>
      <MessagesBadge />
    </Provider>,
  )
  return { store, calls }
}

const unread = (count: number, id = 'c1') => makeConversation({ id, unreadCount: count })

describe('MessagesBadge', () => {
  it('mostra la somma dei non letti di tutte le conversazioni', async () => {
    renderBadge([unread(2, 'c1'), unread(3, 'c2')])
    expect(await screen.findByTestId('messages-badge')).toHaveTextContent('5')
    expect(screen.getByText('5 messaggi non letti')).toHaveClass('visually-hidden')
  })

  it('con un solo messaggio non letto dice «1 messaggio non letto»', async () => {
    renderBadge([unread(1)])
    expect(await screen.findByText('1 messaggio non letto')).toBeInTheDocument()
  })

  it('sopra 9 scrive «9+», ma ai lettori di schermo dice il numero vero', async () => {
    renderBadge([unread(12)])
    expect(await screen.findByTestId('messages-badge')).toHaveTextContent('9+')
    expect(screen.getByText('12 messaggi non letti')).toBeInTheDocument()
  })

  it('senza messaggi non letti non mostra nulla', async () => {
    const { calls } = renderBadge([unread(0)])
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(calls).toHaveLength(1)
    expect(screen.queryByTestId('messages-badge')).not.toBeInTheDocument()
  })

  it('un messaggio in arrivo da un’altra persona lo aumenta, senza chiamare il server', async () => {
    const { store, calls } = renderBadge([unread(1, 'c1')])
    expect(await screen.findByTestId('messages-badge')).toHaveTextContent('1')

    act(() => {
      receiveMessage(
        store.dispatch,
        makeMessage({ id: 'new', conversationId: 'c1', sentAt: '2099-01-01T00:00:00Z' }),
        { myId: makeMe().id, isOpen: false },
      )
    })

    expect(await screen.findByText('2 messaggi non letti')).toBeInTheDocument()
    expect(calls).toHaveLength(1)
  })

  it('da anonimi non chiama il server e non mostra nulla', async () => {
    const { calls } = renderBadge([unread(3)], false)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(calls).toHaveLength(0)
    expect(screen.queryByTestId('messages-badge')).not.toBeInTheDocument()
  })
})

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeConversation } from '@/test/fixtures/chat'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { conversationsFound, conversationsRejected } from '@/test/handlers/chat'
import { server } from '@/test/server'
import type { ConversationResponse } from '@/types/chat'
import { ConversationList } from './ConversationList'

// Elenco delle conversazioni: righe con nome, ultimo messaggio (da UserText) e non letti; conversazioni bloccate con il
// lucchetto; ricerca per nome sulle conversazioni già caricate; stati di caricamento, vuoto ed errore.
const ME = makeMe().id

function renderList(conversations: ConversationResponse[] | 'error', activeId?: string) {
  server.use(
    conversations === 'error'
      ? conversationsRejected(500, 'INTERNAL_ERROR')
      : conversationsFound(conversations),
  )
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse()))
  render(
    <Provider store={store}>
      <MemoryRouter>
        <ConversationList activeId={activeId} />
      </MemoryRouter>
    </Provider>,
  )
  return userEvent.setup()
}

const giulia = makeConversation()
const marco = makeConversation({
  id: 'conv-2',
  otherUser: { id: 'user-3', displayName: 'Marco Bianchi', avatarUrl: null },
  lastMessage: { body: 'Grazie mille', senderId: ME, sentAt: '2026-10-21T10:00:00Z' },
  unreadCount: 0,
  lastMessageAt: '2026-10-21T10:00:00Z',
})

describe('ConversationList · righe', () => {
  it('ogni conversazione è un collegamento con il nome dell’altra persona verso /chat/{id}', async () => {
    renderList([giulia, marco])
    const link = await screen.findByRole('link', { name: 'Giulia Rossi' })
    expect(link).toHaveAttribute('href', '/chat/conv-1')
    expect(screen.getByRole('link', { name: 'Marco Bianchi' })).toHaveAttribute('href', '/chat/conv-2')
  })

  it('mostra l’ultimo messaggio, con «Tu: » davanti se l’ha scritto chi guarda', async () => {
    renderList([giulia, marco])
    expect(await screen.findByText('Ci troviamo alle 20?')).toBeInTheDocument()
    expect(screen.getByText(/^Tu:/)).toHaveTextContent('Tu: Grazie mille')
  })

  it('con i non letti mostra il numero e lo dice ai lettori di schermo', async () => {
    renderList([giulia, marco])
    await screen.findByRole('link', { name: 'Giulia Rossi' })
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]).getByText('2')).toBeInTheDocument()
    expect(within(rows[0]).getByText('2 non letti')).toHaveClass('visually-hidden')
    expect(within(rows[1]).queryByText(/non letti/)).not.toBeInTheDocument()
  })

  it('senza messaggi scrive «Nessun messaggio ancora»', async () => {
    renderList([makeConversation({ lastMessage: null, lastMessageAt: null, unreadCount: 0 })])
    expect(await screen.findByText('Nessun messaggio ancora')).toBeInTheDocument()
  })

  it('una conversazione con canSend falso porta «Chat bloccata»', async () => {
    renderList([makeConversation({ canSend: false }), marco])
    await screen.findByRole('link', { name: 'Giulia Rossi' })
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]).getByText('Chat bloccata')).toBeInTheDocument()
    expect(within(rows[1]).queryByText('Chat bloccata')).not.toBeInTheDocument()
  })

  it('segna con aria-current la conversazione aperta', async () => {
    renderList([giulia, marco], 'conv-2')
    expect(await screen.findByRole('link', { name: 'Marco Bianchi' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Giulia Rossi' })).not.toHaveAttribute('aria-current')
  })

  it('un indirizzo nell’anteprima resta un pulsante con conferma, non un collegamento dentro il collegamento', async () => {
    renderList([
      makeConversation({
        lastMessage: { body: 'Guarda https://esempio.it/brano', senderId: 'user-2', sentAt: '2026-10-22T18:42:00Z' },
      }),
    ])
    expect(await screen.findByRole('button', { name: 'https://esempio.it/brano' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })
})

describe('ConversationList · ricerca', () => {
  it('filtra per nome mentre si scrive, senza distinguere maiuscole', async () => {
    const user = renderList([giulia, marco])
    await screen.findByRole('link', { name: 'Giulia Rossi' })

    await user.type(screen.getByRole('searchbox', { name: 'Cerca nelle conversazioni' }), 'MARCO')

    expect(screen.queryByRole('link', { name: 'Giulia Rossi' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Marco Bianchi' })).toBeInTheDocument()
  })

  it('senza risultati scrive «Nessuna conversazione trovata.»', async () => {
    const user = renderList([giulia, marco])
    await screen.findByRole('link', { name: 'Giulia Rossi' })

    await user.type(screen.getByRole('searchbox', { name: 'Cerca nelle conversazioni' }), 'zzz')

    expect(screen.getByText('Nessuna conversazione trovata.')).toBeInTheDocument()
  })
})

describe('ConversationList · stati', () => {
  it('senza conversazioni scrive «Non hai ancora conversazioni.» con il collegamento «Cerca persone»', async () => {
    renderList([])
    expect(await screen.findByText('Non hai ancora conversazioni.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cerca persone' })).toHaveAttribute('href', '/amici/cerca')
  })

  it('se il server non risponde mostra l’errore e nessuna riga', async () => {
    renderList('error')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})

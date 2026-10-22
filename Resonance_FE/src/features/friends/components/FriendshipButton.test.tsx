import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { ConfirmationBar } from '@/components/ui/ConfirmationBar'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeConversation } from '@/test/fixtures/chat'
import { makeFriendship } from '@/test/fixtures/friends'
import { makeLoginResponse } from '@/test/fixtures/users'
import { conversationOpened, conversationOpenRejected } from '@/test/handlers/chat'
import {
  friendshipActionRejected,
  friendshipActionSucceeds,
  friendshipRemoved,
  friendshipRemoveRejected,
  friendshipRequested,
  friendshipRequestRejected,
} from '@/test/handlers/friends'
import { server } from '@/test/server'
import type { FriendshipView } from '@/types/friends'
import { FriendshipButton } from './FriendshipButton'

// Pulsante dell'amicizia: azioni giuste per ognuno dei cinque stati, chiamata al backend, conferma scritta in cima
// alla pagina (4 secondi), «Rimuovi» con conferma, «Scrivi» che apre la chat, errori nella riga.

/** Scrive il percorso attuale: i test controllano dove porta un clic. */
function LocationProbe() {
  return <p data-testid="location">{useLocation().pathname}</p>
}
function renderButton(status: FriendshipView, friendshipId: string | null = null) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse()))
  render(
    <Provider store={store}>
      <MemoryRouter>
        <ConfirmationBar />
        <LocationProbe />
        <FriendshipButton userId="u-mario" displayName="Mario Rossi" status={status} friendshipId={friendshipId} />
      </MemoryRouter>
    </Provider>,
  )
  return userEvent.setup()
}

describe('FriendshipButton · un’azione per stato', () => {
  it('NONE: solo «Aggiungi»', () => {
    renderButton('NONE')

    expect(screen.getByRole('button', { name: /^Aggiungi/ })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /^Annulla/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Accetta/ })).not.toBeInTheDocument()
  })

  it('OUTGOING: «Richiesta inviata» e «Annulla»', () => {
    renderButton('OUTGOING', 'f1')

    expect(screen.getByText('Richiesta inviata')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Annulla/ })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /^Aggiungi/ })).not.toBeInTheDocument()
  })

  it('INCOMING: «Accetta» e «Rifiuta»', () => {
    renderButton('INCOMING', 'f1')

    expect(screen.getByRole('button', { name: /^Accetta/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^Rifiuta/ })).toBeEnabled()
  })

  it('FRIENDS: «Amici», «Rimuovi» e «Scrivi» attivi, senza note di attesa', () => {
    renderButton('FRIENDS', 'f1')

    expect(screen.getByText('Amici')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Rimuovi/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^Scrivi/ })).toBeEnabled()
    expect(screen.queryByText('Disponibile a breve')).not.toBeInTheDocument()
  })

  it('UNAVAILABLE: «Non disponibile» spento, nessuna azione', () => {
    renderButton('UNAVAILABLE')

    expect(screen.getByRole('button', { name: /^Non disponibile/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /^Aggiungi/ })).not.toBeInTheDocument()
  })

  it('ogni pulsante ha il nome della persona nel nome accessibile', () => {
    renderButton('INCOMING', 'f1')

    expect(screen.getByRole('button', { name: 'Accetta: Mario Rossi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rifiuta: Mario Rossi' })).toBeInTheDocument()
  })
})

describe('FriendshipButton · azioni', () => {
  it('«Aggiungi» manda lo userId e conferma con «Richiesta inviata»', async () => {
    const calls: Request[] = []
    server.use(friendshipRequested(makeFriendship({ status: 'OUTGOING' }), calls))
    const user = renderButton('NONE')

    await user.click(screen.getByRole('button', { name: /^Aggiungi/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Richiesta inviata')
    expect(await calls[0].json()).toEqual({ userId: 'u-mario' })
  })

  it('«Annulla» chiama cancel sull’amicizia e conferma con «Richiesta annullata»', async () => {
    const calls: Request[] = []
    server.use(friendshipActionSucceeds('cancel', calls))
    const user = renderButton('OUTGOING', 'f-out')

    await user.click(screen.getByRole('button', { name: /^Annulla/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Richiesta annullata')
    expect(new URL(calls[0].url).pathname).toBe('/api/friendships/f-out/cancel')
  })

  it('«Accetta» chiama accept e conferma con «Amicizia accettata»', async () => {
    const calls: Request[] = []
    server.use(friendshipActionSucceeds('accept', calls, makeFriendship()))
    const user = renderButton('INCOMING', 'f-in')

    await user.click(screen.getByRole('button', { name: /^Accetta/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Amicizia accettata')
    expect(new URL(calls[0].url).pathname).toBe('/api/friendships/f-in/accept')
  })

  it('«Rifiuta» chiama decline e conferma con «Richiesta rifiutata»', async () => {
    const calls: Request[] = []
    server.use(friendshipActionSucceeds('decline', calls))
    const user = renderButton('INCOMING', 'f-in')

    await user.click(screen.getByRole('button', { name: /^Rifiuta/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Richiesta rifiutata')
    expect(new URL(calls[0].url).pathname).toBe('/api/friendships/f-in/decline')
  })

  it('un’azione senza friendshipId (dato mancante) non parte: il pulsante è spento', () => {
    renderButton('INCOMING', null)

    expect(screen.getByRole('button', { name: /^Accetta/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^Rifiuta/ })).toBeDisabled()
  })
})

describe('FriendshipButton · rimozione', () => {
  it('«Rimuovi» apre la conferma con il nome e non chiama il backend finché non confermi', async () => {
    const calls: Request[] = []
    server.use(friendshipRemoved(calls))
    const user = renderButton('FRIENDS', 'f-fr')

    await user.click(screen.getByRole('button', { name: /^Rimuovi/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Rimuovere Mario Rossi dagli amici?' })
    expect(dialog).toHaveTextContent(
      'La chat resta leggibile, ma nessuno dei due potrà più scrivere. Mario Rossi non riceve nessun avviso.',
    )
    expect(calls).toHaveLength(0)
  })

  it('confermando chiama DELETE e scrive «Amicizia rimossa»', async () => {
    const calls: Request[] = []
    server.use(friendshipRemoved(calls))
    const user = renderButton('FRIENDS', 'f-fr')

    await user.click(screen.getByRole('button', { name: /^Rimuovi/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Rimuovi' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Amicizia rimossa')
    expect(new URL(calls[0].url).pathname).toBe('/api/friendships/f-fr')
    expect(calls[0].method).toBe('DELETE')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('«Annulla» nella conferma chiude senza chiamare il backend', async () => {
    const calls: Request[] = []
    server.use(friendshipRemoved(calls))
    const user = renderButton('FRIENDS', 'f-fr')

    await user.click(screen.getByRole('button', { name: /^Rimuovi/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Annulla' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toHaveLength(0)
  })

  it('un errore del backend chiude la finestra e si legge nella riga, senza conferma scritta', async () => {
    server.use(friendshipRemoveRejected(403, 'NOT_FRIENDS'))
    const user = renderButton('FRIENDS', 'f-fr')

    await user.click(screen.getByRole('button', { name: /^Rimuovi/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Rimuovi' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Non c'è un'amicizia accettata con questa persona.")
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('FriendshipButton · errori', () => {
  it('FRIEND_REQUEST_ALREADY_RECEIVED è un invito, non un errore: la striscia dice che la richiesta è già arrivata', async () => {
    server.use(friendshipRequestRejected(409, 'FRIEND_REQUEST_ALREADY_RECEIVED'))
    const user = renderButton('NONE')

    await user.click(screen.getByRole('button', { name: /^Aggiungi/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Questa persona ti ha già inviato una richiesta')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('un altro errore (TOO_MANY_REQUESTS) resta scritto nella riga, in rosso', async () => {
    server.use(friendshipRequestRejected(429, 'TOO_MANY_REQUESTS'))
    const user = renderButton('NONE')

    await user.click(screen.getByRole('button', { name: /^Aggiungi/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Troppi tentativi: attendi un momento e riprova.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('un errore di accettazione (FRIEND_REQUEST_NOT_PENDING) si legge nella riga', async () => {
    server.use(friendshipActionRejected('accept', 409, 'FRIEND_REQUEST_NOT_PENDING'))
    const user = renderButton('INCOMING', 'f-in')

    await user.click(screen.getByRole('button', { name: /^Accetta/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La richiesta non è più in attesa.')
  })
})

describe('FriendshipButton · Scrivi', () => {
  it('«Scrivi» apre la conversazione con la persona (POST /api/chats) e porta alla chat', async () => {
    const calls: Request[] = []
    server.use(conversationOpened(makeConversation({ id: 'conv-77' }), calls))
    const user = renderButton('FRIENDS', 'f1')

    await user.click(screen.getByRole('button', { name: /^Scrivi/ }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/chat/conv-77'))
    expect(await calls[0].json()).toEqual({ recipientId: 'u-mario' })
  })

  it('se il server rifiuta (NOT_FRIENDS) resta nella riga con l’errore e non cambia pagina', async () => {
    server.use(conversationOpenRejected(403, 'NOT_FRIENDS'))
    const user = renderButton('FRIENDS', 'f1')

    await user.click(screen.getByRole('button', { name: /^Scrivi/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Non c'è un'amicizia accettata con questa persona.")
    expect(screen.getByTestId('location')).toHaveTextContent('/')
    expect(screen.queryByTestId('location')).not.toHaveTextContent('/chat')
  })
})

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { QUEUES } from '@/lib/stomp/destinations'
import { makeConversation, makeMessage } from '@/test/fixtures/chat'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { conversationsFound, messagesFound, readSucceeds } from '@/test/handlers/chat'
import { server } from '@/test/server'
import type { ChatMessageResponse, ConversationResponse, MessagePageResponse } from '@/types/chat'
import { ConversationView } from './ConversationView'

// Il client STOMP è simulato: i test guidano a mano la coda dei messaggi, quella degli errori e lo stato della
// connessione; il client vero ha i suoi test.
const stomp = vi.hoisted(() => ({
  send: vi.fn<(...args: unknown[]) => boolean>(),
  listeners: {} as Record<string, Set<(body: unknown) => void>>,
  status: { current: 'connected', observers: new Set<() => void>() },
}))
vi.mock('@/lib/stomp/client', () => {
  return {
    send: (...args: unknown[]) => stomp.send(...args),
    subscribe: (queue: string, callback: (body: unknown) => void) => {
      const set = (stomp.listeners[queue] ??= new Set())
      set.add(callback)
      return () => set.delete(callback)
    },
    onStompReconnected: () => () => undefined,
    startStomp: () => undefined,
    stopStomp: () => undefined,
  }
})
vi.mock('@/lib/stomp/useStompStatus', async () => {
  const { useSyncExternalStore } = await import('react')
  return {
    useStompStatus: () =>
      useSyncExternalStore(
        (observer) => {
          stomp.status.observers.add(observer)
          return () => stomp.status.observers.delete(observer)
        },
        () => stomp.status.current,
      ),
  }
})

const ME = makeMe().id
const CONVERSATION = 'conv-1'

/** Istante a un'ora di un giorno passato (0 = oggi), nell'ora locale: i test non dipendono dal giorno in cui girano. */
function at(daysAgo: number, hour = 10, minute = 0) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

const message = (id: string, overrides: Partial<ChatMessageResponse> = {}) =>
  makeMessage({ id, conversationId: CONVERSATION, body: `testo ${id}`, ...overrides })

const setStatus = (status: string) =>
  act(() => {
    stomp.status.current = status
    stomp.status.observers.forEach((observer) => observer())
  })

const push = (queue: string, body: unknown) =>
  act(() => {
    stomp.listeners[queue]?.forEach((callback) => callback(body))
  })

type SetupOptions = {
  conversation?: Partial<ConversationResponse>
  pages?: MessagePageResponse[]
}

function setup({ conversation = {}, pages = [{ messages: [], hasMore: false }] }: SetupOptions = {}) {
  const read: Request[] = []
  const history: Request[] = []
  const list: Request[] = []
  server.use(
    conversationsFound([makeConversation({ id: CONVERSATION, unreadCount: 0, ...conversation })], list),
    messagesFound(CONVERSATION, pages, history),
    readSucceeds(CONVERSATION, read),
  )
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse()))
  render(
    <Provider store={store}>
      <MemoryRouter>
        <ConversationView conversationId={CONVERSATION} />
      </MemoryRouter>
    </Provider>,
  )
  return { store, read, history, list, user: userEvent.setup() }
}

const composer = () => screen.getByRole('textbox', { name: 'Messaggio per Giulia Rossi' })

beforeEach(() => {
  stomp.send.mockReset()
  stomp.send.mockReturnValue(true)
  stomp.status.current = 'connected'
  Object.values(stomp.listeners).forEach((set) => set.clear())
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ConversationView · storico', () => {
  it('mostra i messaggi dal più vecchio al più recente e riconosce i propri da senderId', async () => {
    setup({
      pages: [
        {
          messages: [message('m2', { senderId: ME, body: 'Io', sentAt: at(0, 10, 5) }), message('m1', { body: 'Lei', sentAt: at(0, 10, 0) })],
          hasMore: false,
        },
      ],
    })

    const list = await screen.findByRole('list', { name: 'Messaggi con Giulia Rossi' })
    const items = within(list).getAllByRole('listitem').filter((item) => item.classList.contains('rs-message'))
    expect(items.map((item) => item.textContent)).toEqual([expect.stringContaining('Lei'), expect.stringContaining('Io')])
    expect(items[0]).toHaveClass('rs-message--other')
    expect(items[1]).toHaveClass('rs-message--own')
  })

  it('separa i giorni con «Oggi» e «Ieri» e scrive l’ora sotto ogni messaggio', async () => {
    setup({
      pages: [{ messages: [message('m2', { sentAt: at(0, 9, 30) }), message('m1', { sentAt: at(1, 22, 15) })], hasMore: false }],
    })

    expect(await screen.findByText('Ieri')).toBeInTheDocument()
    expect(screen.getByText('Oggi')).toBeInTheDocument()
    expect(screen.getByText('22:15')).toBeInTheDocument()
    expect(screen.getByText('09:30')).toBeInTheDocument()
  })

  it('un indirizzo nel messaggio resta un pulsante con conferma (UserText)', async () => {
    setup({ pages: [{ messages: [message('m1', { body: 'Ascolta https://esempio.it/brano' })], hasMore: false }] })
    expect(await screen.findByRole('button', { name: 'https://esempio.it/brano' })).toBeInTheDocument()
  })

  it('senza messaggi invita a scrivere il primo', async () => {
    setup()
    expect(await screen.findByText('Nessun messaggio: scrivi il primo.')).toBeInTheDocument()
  })

  it('«Messaggi precedenti» carica con before l’id del messaggio più vecchio e li mette sopra, senza buchi', async () => {
    const { history, user } = setup({
      pages: [
        { messages: [message('m4', { sentAt: at(0, 10, 3) }), message('m3', { sentAt: at(0, 10, 2) })], hasMore: true },
        { messages: [message('m2', { sentAt: at(0, 10, 1) }), message('m1', { sentAt: at(0, 10, 0) })], hasMore: false },
      ],
    })
    await screen.findByText('testo m4')

    await user.click(screen.getByRole('button', { name: 'Messaggi precedenti' }))

    await screen.findByText('testo m1')
    expect(new URL(history.at(-1)!.url).searchParams.get('before')).toBe('m3')
    const texts = screen.getAllByText(/^testo m\d$/).map((node) => node.textContent)
    expect(texts).toEqual(['testo m1', 'testo m2', 'testo m3', 'testo m4'])
    // Non ce ne sono altri: il pulsante sparisce
    expect(screen.queryByRole('button', { name: 'Messaggi precedenti' })).not.toBeInTheDocument()
  })

  it('senza messaggi più vecchi non mostra «Messaggi precedenti»', async () => {
    setup({ pages: [{ messages: [message('m1')], hasMore: false }] })
    await screen.findByText('testo m1')
    expect(screen.queryByRole('button', { name: 'Messaggi precedenti' })).not.toBeInTheDocument()
  })
})

describe('ConversationView · spunte dei messaggi miei', () => {
  it('un mio messaggio non letto ha la spunta singola «Inviato»; uno letto la doppia «Letto»', async () => {
    setup({
      pages: [
        {
          messages: [
            message('m2', { senderId: ME, readAt: at(0, 10, 9), sentAt: at(0, 10, 2) }),
            message('m1', { senderId: ME, readAt: null, sentAt: at(0, 10, 1) }),
          ],
          hasMore: false,
        },
      ],
    })
    await screen.findByText('testo m1')

    expect(screen.getAllByText('Inviato')).toHaveLength(1)
    expect(screen.getAllByText('Letto')).toHaveLength(1)
    expect(screen.getByTestId('ticks-sent')).toBeInTheDocument()
    expect(screen.getByTestId('ticks-read')).toBeInTheDocument()
  })

  it('i messaggi dell’altro non hanno spunte', async () => {
    setup({ pages: [{ messages: [message('m1', { readAt: at(0, 10, 9) })], hasMore: false }] })
    await screen.findByText('testo m1')
    expect(screen.queryByText('Inviato')).not.toBeInTheDocument()
    expect(screen.queryByText('Letto')).not.toBeInTheDocument()
  })
})

describe('ConversationView · lettura', () => {
  it('all’apertura, con messaggi non letti, segna la conversazione letta', async () => {
    const { read } = setup({ conversation: { unreadCount: 3 }, pages: [{ messages: [message('m1')], hasMore: false }] })
    await waitFor(() => expect(read).toHaveLength(1))
  })

  it('senza non letti non chiama il server per la lettura', async () => {
    const { read } = setup({ pages: [{ messages: [message('m1')], hasMore: false }] })
    await screen.findByText('testo m1')
    expect(read).toHaveLength(0)
  })

  it('un messaggio dell’altro arrivato a conversazione aperta compare e segna letto', async () => {
    const { read } = setup({ pages: [{ messages: [message('m1')], hasMore: false }] })
    await screen.findByText('testo m1')

    push(QUEUES.messages, message('m2', { body: 'Nuovo da lei', sentAt: at(0, 11, 0) }))

    expect(await screen.findByText('Nuovo da lei')).toBeInTheDocument()
    await waitFor(() => expect(read).toHaveLength(1))
  })

  it('un messaggio di un’altra conversazione non entra in questo storico', async () => {
    const { read } = setup({ pages: [{ messages: [message('m1')], hasMore: false }] })
    await screen.findByText('testo m1')

    push(QUEUES.messages, message('mx', { conversationId: 'altra', body: 'Altrove' }))

    expect(screen.queryByText('Altrove')).not.toBeInTheDocument()
    expect(read).toHaveLength(0)
  })

  it('lo stesso messaggio consegnato due volte compare una volta sola e non segna letto due volte', async () => {
    const { read } = setup({ pages: [{ messages: [message('m1')], hasMore: false }] })
    await screen.findByText('testo m1')

    const duplicate = message('m2', { body: 'Doppio', sentAt: at(0, 11, 0) })
    push(QUEUES.messages, duplicate)
    push(QUEUES.messages, duplicate)

    await screen.findByText('Doppio')
    expect(screen.getAllByText('Doppio')).toHaveLength(1)
    await waitFor(() => expect(read).toHaveLength(1))
  })
})

describe('ConversationView · intestazione e casella', () => {
  it('mostra il nome con il collegamento al profilo pubblico e quello per tornare all’elenco', async () => {
    setup()
    expect(await screen.findByRole('link', { name: 'Giulia Rossi' })).toHaveAttribute('href', '/utenti/user-2')
    expect(screen.getByRole('link', { name: 'Torna alle conversazioni' })).toHaveAttribute('href', '/chat')
  })

  it('con canSend falso la casella e Invia sono spenti, c’è la spiegazione neutra e «Chat bloccata»', async () => {
    setup({ conversation: { canSend: false } })

    expect(await screen.findByText('Chat bloccata')).toBeInTheDocument()
    expect(
      screen.getByText('Al momento non puoi inviare messaggi a questa persona. Puoi rileggere la conversazione.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Messaggio per/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Invia' })).toBeDisabled()
  })

  it('con canSend falso lo storico resta leggibile', async () => {
    setup({ conversation: { canSend: false }, pages: [{ messages: [message('m1')], hasMore: false }] })
    expect(await screen.findByText('testo m1')).toBeInTheDocument()
  })

  it('una conversazione che non è nell’elenco mostra l’errore «non trovato»', async () => {
    server.use(conversationsFound([]), messagesFound(CONVERSATION, [{ messages: [], hasMore: false }]))
    const store = makeStore()
    store.dispatch(sessionStarted(makeLoginResponse()))
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ConversationView conversationId={CONVERSATION} />
        </MemoryRouter>
      </Provider>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Quello che cerchi non esiste o non è più disponibile.')
  })
})

describe('ConversationView · invio', () => {
  it('Invio manda il testo ripulito su /app/chats/{id}/send e svuota la casella', async () => {
    const { user } = setup()
    await screen.findByRole('textbox', { name: 'Messaggio per Giulia Rossi' })

    await user.type(composer(), '  Ciao a tutti  {Enter}')

    expect(stomp.send).toHaveBeenCalledWith('/app/chats/conv-1/send', { body: 'Ciao a tutti' })
    expect(composer()).toHaveValue('')
  })

  it('Maiusc+Invio va a capo e non invia', async () => {
    const { user } = setup()
    await screen.findByRole('textbox', { name: 'Messaggio per Giulia Rossi' })

    await user.type(composer(), 'riga uno{Shift>}{Enter}{/Shift}riga due')

    expect(stomp.send).not.toHaveBeenCalled()
    expect(composer()).toHaveValue('riga uno\nriga due')
  })

  it('il pulsante Invia è spento senza testo e un testo di soli spazi non parte', async () => {
    const { user } = setup()
    await screen.findByRole('textbox', { name: 'Messaggio per Giulia Rossi' })
    const button = screen.getByRole('button', { name: 'Invia' })
    expect(button).toBeDisabled()

    await user.type(composer(), '   {Enter}')
    expect(stomp.send).not.toHaveBeenCalled()
  })

  it('mostra il contatore «n / 2000» e non accetta più di 2000 caratteri', async () => {
    const { user } = setup()
    await screen.findByRole('textbox', { name: 'Messaggio per Giulia Rossi' })
    expect(screen.getByText('0 / 2000')).toBeInTheDocument()

    await user.type(composer(), 'abc')
    expect(screen.getByText('3 / 2000')).toBeInTheDocument()
    expect(composer()).toHaveAttribute('maxlength', '2000')
  })

  it('dice lo stato della connessione e spegne Invia se non si è connessi', async () => {
    const { user } = setup()
    await screen.findByRole('textbox', { name: 'Messaggio per Giulia Rossi' })
    expect(screen.getByRole('status')).toHaveTextContent('Connesso')

    setStatus('reconnecting')
    expect(screen.getByRole('status')).toHaveTextContent('Riconnessione…')
    await user.type(composer(), 'Ciao')
    expect(screen.getByRole('button', { name: 'Invia' })).toBeDisabled()

    setStatus('connecting')
    expect(screen.getByRole('status')).toHaveTextContent('Connessione…')
  })

  it('se il client non può inviare (nessuna connessione) il testo resta nella casella con l’errore', async () => {
    stomp.send.mockReturnValue(false)
    const { user } = setup()
    await screen.findByRole('textbox', { name: 'Messaggio per Giulia Rossi' })

    await user.type(composer(), 'Ciao{Enter}')

    expect(composer()).toHaveValue('Ciao')
    expect(await screen.findByRole('alert')).toHaveTextContent('Messaggio non inviato: controlla la connessione e riprova.')
  })
})

describe('ConversationView · invio in attesa', () => {
  /** Carica la conversazione con timer veri, poi passa ai timer finti per guidare 300 ms e 10 s. */
  async function setupWithFakeTimers() {
    const ctx = setup()
    await screen.findByRole('textbox', { name: 'Messaggio per Giulia Rossi' })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    return ctx
  }
  const advance = (ms: number) => act(async () => void vi.advanceTimersByTime(ms))
  // `user.type` di Testing Library aspetta un setTimeout: con i timer finti si bloccherebbe, quindi qui si usa fireEvent
  const write = (text: string) => {
    fireEvent.change(composer(), { target: { value: text } })
    fireEvent.keyDown(composer(), { key: 'Enter' })
  }

  it('il segnaposto «Invio…» compare solo dopo 300 ms senza eco, con il testo inviato', async () => {
    await setupWithFakeTimers()
    write('Ciao')

    await advance(299)
    expect(screen.queryByText('Invio…')).not.toBeInTheDocument()

    await advance(1)
    expect(screen.getByText('Invio…')).toBeInTheDocument()
    expect(screen.getByText('Ciao')).toBeInTheDocument()
  })

  it('l’eco prima dei 300 ms evita il segnaposto: compare solo il messaggio vero, una volta', async () => {
    await setupWithFakeTimers()
    write('Ciao')

    push(QUEUES.messages, message('m9', { senderId: ME, body: 'Ciao', sentAt: at(0, 12, 0) }))
    await advance(1000)

    expect(screen.queryByText('Invio…')).not.toBeInTheDocument()
    expect(screen.getAllByText('Ciao')).toHaveLength(1)
  })

  it('l’eco dopo il segnaposto lo sostituisce con il messaggio vero', async () => {
    await setupWithFakeTimers()
    write('Ciao')
    await advance(400)
    expect(screen.getByText('Invio…')).toBeInTheDocument()

    push(QUEUES.messages, message('m9', { senderId: ME, body: 'Ciao', sentAt: at(0, 12, 0) }))

    expect(screen.queryByText('Invio…')).not.toBeInTheDocument()
    expect(screen.getAllByText('Ciao')).toHaveLength(1)
  })

  it('senza eco entro 10 secondi il segnaposto sparisce, il testo torna nella casella e compare l’errore', async () => {
    await setupWithFakeTimers()
    write('Ciao')
    await advance(9_999)
    expect(composer()).toHaveValue('')

    await advance(1)

    expect(screen.queryByText('Invio…')).not.toBeInTheDocument()
    expect(composer()).toHaveValue('Ciao')
    expect(screen.getByRole('alert')).toHaveTextContent('Messaggio non inviato: controlla la connessione e riprova.')
  })

  it('se la connessione cade con un messaggio in attesa, il testo torna nella casella con l’errore', async () => {
    await setupWithFakeTimers()
    write('Ciao')
    await advance(400)

    setStatus('reconnecting')

    expect(screen.queryByText('Invio…')).not.toBeInTheDocument()
    expect(composer()).toHaveValue('Ciao')
    expect(screen.getByRole('alert')).toHaveTextContent('Messaggio non inviato: controlla la connessione e riprova.')
  })

  it('un errore della coda (troppi messaggi) riporta il testo nella casella con il testo di quel codice', async () => {
    await setupWithFakeTimers()
    write('Ciao')
    await advance(400)

    push(QUEUES.errors, { code: 'TOO_MANY_REQUESTS', message: 'Troppi messaggi' })

    expect(screen.queryByText('Invio…')).not.toBeInTheDocument()
    expect(composer()).toHaveValue('Ciao')
    expect(screen.getByRole('alert')).toHaveTextContent('Troppi tentativi: attendi un momento e riprova.')
  })

  it('CHAT_LOCKED riporta il testo e ricarica l’elenco: canSend diventa falso e la casella si spegne', async () => {
    const { list } = await setupWithFakeTimers()
    server.use(conversationsFound([makeConversation({ id: CONVERSATION, unreadCount: 0, canSend: false })], list))
    write('Ciao')

    push(QUEUES.errors, { code: 'CHAT_LOCKED', message: 'Al momento non puoi inviare messaggi a questo utente' })
    vi.useRealTimers()

    await waitFor(() => expect(list.length).toBeGreaterThanOrEqual(2))
    expect(await screen.findByText('Chat bloccata')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Messaggio per/ })).toBeDisabled()
  })

  it('un errore senza messaggi in attesa (di un’altra scheda) non tocca la casella', async () => {
    await setupWithFakeTimers()
    fireEvent.change(composer(), { target: { value: 'bozza' } })

    push(QUEUES.errors, { code: 'TOO_MANY_REQUESTS', message: 'Troppi messaggi' })

    expect(composer()).toHaveValue('bozza')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('i codici gestiti dal client (token, sospensione) non mostrano errori nella chat', async () => {
    await setupWithFakeTimers()
    write('Ciao')
    await advance(400)

    push(QUEUES.errors, { code: 'TOKEN_INVALID', message: 'Token scaduto' })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

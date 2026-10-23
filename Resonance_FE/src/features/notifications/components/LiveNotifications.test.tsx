import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionEnded, sessionStarted } from '@/features/auth/authSlice'
import { chatApi } from '@/features/chat/api/chatApi'
import { friendsApi } from '@/features/friends/api/friendsApi'
import { totalUnread } from '@/features/chat/chatCache'
import { confirmationShown } from '@/lib/notices/confirmationSlice'
import { QUEUES } from '@/lib/stomp/destinations'
import { makeConversation, makeMessage } from '@/test/fixtures/chat'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { makeNotifications } from '@/test/fixtures/notifications'
import { conversationsFound } from '@/test/handlers/chat'
import { friendshipsFound } from '@/test/handlers/friends'
import {
  notificationPage,
  notificationReadSucceeds,
  notificationsFound,
  unreadCountFound,
} from '@/test/handlers/notifications'
import { server } from '@/test/server'
import { notificationsApi } from '../api/notificationsApi'
import { selectToasts } from '../notificationsSlice'
import { LiveNotifications } from './LiveNotifications'

// Il client STOMP è simulato: qui si guarda cosa fa il componente (avvia e ferma la connessione, applica i messaggi in
// arrivo all'elenco delle conversazioni, ricarica dopo una riconnessione); il client ha i suoi test.
const { startStomp, stopStomp, handlers, reconnected } = vi.hoisted(() => ({
  startStomp: vi.fn(),
  stopStomp: vi.fn(),
  handlers: {} as Record<string, (body: unknown) => void>,
  reconnected: { current: (() => undefined) as () => void },
}))
vi.mock('@/lib/stomp/client', () => ({
  startStomp,
  stopStomp,
  subscribe: vi.fn((queue: string, callback: (body: unknown) => void) => {
    handlers[queue] = callback
    return () => {
      delete handlers[queue]
    }
  }),
  onStompReconnected: vi.fn((listener: () => void) => {
    reconnected.current = listener
    return () => undefined
  }),
}))

const ME = makeMe().id

describe('LiveNotifications · connessione', () => {
  beforeEach(() => {
    startStomp.mockClear()
    stopStomp.mockClear()
  })

  function renderWith(store = makeStore()) {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <LiveNotifications />
        </MemoryRouter>
      </Provider>,
    )
    return store
  }

  it('con la sessione aperta avvia la connessione passando lo store', () => {
    const store = makeStore()
    store.dispatch(sessionStarted(makeLoginResponse()))
    renderWith(store)
    expect(startStomp).toHaveBeenCalledTimes(1)
    expect(startStomp).toHaveBeenCalledWith(store)
  })

  it('da anonimi non apre nessuna connessione', () => {
    renderWith()
    expect(startStomp).not.toHaveBeenCalled()
  })

  it('quando la sessione si chiude (uscita o sospensione) ferma la connessione', () => {
    const store = makeStore()
    store.dispatch(sessionStarted(makeLoginResponse()))
    renderWith(store)
    stopStomp.mockClear()

    act(() => {
      store.dispatch(sessionEnded({ suspension: { suspensionReason: 'Spam', suspendedUntil: null } }))
    })
    expect(stopStomp).toHaveBeenCalled()
  })

  it('un refresh del token non riapre la connessione da qui (lo fa il client)', () => {
    const store = makeStore()
    store.dispatch(sessionStarted(makeLoginResponse()))
    renderWith(store)

    act(() => {
      store.dispatch({ type: 'auth/tokenRefreshed', payload: makeLoginResponse({ accessToken: 'access-2' }) })
    })
    expect(startStomp).toHaveBeenCalledTimes(1)
  })
})

describe('LiveNotifications · messaggi in arrivo', () => {
  /** Monta il componente sul percorso indicato con l'elenco già in cache; `calls` conta le richieste all'elenco. */
  async function setup(path = '/eventi') {
    const calls: Request[] = []
    server.use(conversationsFound([makeConversation({ id: 'c1', unreadCount: 1 })], calls))
    const store = makeStore()
    store.dispatch(sessionStarted(makeLoginResponse()))
    await store.dispatch(chatApi.endpoints.getConversations.initiate()).unwrap()
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <LiveNotifications />
        </MemoryRouter>
      </Provider>,
    )
    const unread = () => totalUnread(chatApi.endpoints.getConversations.select()(store.getState()).data ?? [])
    return { store, calls, unread }
  }

  const push = (overrides = {}) =>
    act(() => {
      handlers[QUEUES.messages](makeMessage({ conversationId: 'c1', sentAt: '2099-01-01T00:00:00Z', ...overrides }))
    })

  it('un messaggio dell’altro aggiunge un non letto senza chiamare il server', async () => {
    const { calls, unread } = await setup()
    push()
    expect(unread()).toBe(2)
    expect(calls).toHaveLength(1)
  })

  it('un messaggio mio non aggiunge non letti', async () => {
    const { unread } = await setup()
    push({ senderId: ME })
    expect(unread()).toBe(1)
  })

  it('se quella conversazione è aperta non aggiunge non letti', async () => {
    const { unread } = await setup('/chat/c1')
    push()
    expect(unread()).toBe(1)
  })

  it('un messaggio di una conversazione non in elenco ricarica l’elenco', async () => {
    const { calls } = await setup()
    push({ conversationId: 'nuova' })
    await vi.waitFor(() => expect(calls).toHaveLength(2))
  })

  it('dopo una riconnessione ricarica l’elenco delle conversazioni', async () => {
    const { calls } = await setup()
    act(() => reconnected.current())
    await vi.waitFor(() => expect(calls).toHaveLength(2))
  })

  it('dopo una riconnessione rilegge anche notifiche salvate e numero: quelle arrivate a connessione caduta', async () => {
    const counts: Request[] = []
    server.use(notificationsFound([notificationPage(makeNotifications(2))]), unreadCountFound(2, counts))
    const { store } = await setup()
    await store.dispatch(notificationsApi.endpoints.getUnreadCount.initiate()).unwrap()
    await store.dispatch(notificationsApi.endpoints.getNotifications.initiate(0)).unwrap()
    expect(counts).toHaveLength(1)

    act(() => reconnected.current())

    await vi.waitFor(() => expect(counts).toHaveLength(2))
  })

  it('dopo una riconnessione rilegge anche le richieste di amicizia ricevute: il badge di Amici', async () => {
    const requests: Request[] = []
    server.use(friendshipsFound({}, requests))
    const { store } = await setup()
    await store.dispatch(friendsApi.endpoints.getPendingRequests.initiate()).unwrap()
    expect(requests).toHaveLength(1)

    act(() => reconnected.current())

    await vi.waitFor(() => expect(requests).toHaveLength(2))
  })
})

describe('LiveNotifications · notifiche', () => {
  const notification = (overrides = {}) => ({
    id: 'n-1',
    type: 'NEW_LIKE',
    createdAt: '2026-10-22T10:00:00Z',
    actor: { id: 'u1', displayName: 'Giulia Rossi', avatarUrl: null },
    targetId: 'post-1',
    preview: null,
    ...overrides,
  })

  function setup(path = '/feed') {
    const store = makeStore()
    store.dispatch(sessionStarted(makeLoginResponse()))
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <LiveNotifications />
        </MemoryRouter>
      </Provider>,
    )
    const push = (body: unknown) => act(() => handlers[QUEUES.notifications](body))
    return { store, push }
  }

  it('una notifica salvata va al toast e, con elenco e numero in cache, entra in cima e alza il numero', async () => {
    server.use(notificationsFound([notificationPage(makeNotifications(2))]), unreadCountFound(2))
    const { store, push } = setup()
    await store.dispatch(notificationsApi.endpoints.getNotifications.initiate(0)).unwrap()
    await store.dispatch(notificationsApi.endpoints.getUnreadCount.initiate()).unwrap()

    push(notification({ id: 'live-1' }))

    expect(selectToasts(store.getState())).toHaveLength(1)
    const list = notificationsApi.endpoints.getNotifications.select(0)(store.getState()).data
    expect(list?.content[0]).toMatchObject({ id: 'live-1', type: 'NEW_LIKE', read: false })
    expect(notificationsApi.endpoints.getUnreadCount.select()(store.getState()).data).toBe(3)
  })

  it('un nuovo messaggio fuori dalla sua conversazione ha il toast ma non entra nell’elenco salvato né nel numero', async () => {
    server.use(notificationsFound([notificationPage(makeNotifications(2))]), unreadCountFound(2))
    const { store, push } = setup('/feed')
    await store.dispatch(notificationsApi.endpoints.getNotifications.initiate(0)).unwrap()
    await store.dispatch(notificationsApi.endpoints.getUnreadCount.initiate()).unwrap()

    push(notification({ id: null, type: 'NEW_MESSAGE', targetId: 'c1', preview: 'Ciao' }))

    expect(selectToasts(store.getState())).toHaveLength(1)
    expect(notificationsApi.endpoints.getNotifications.select(0)(store.getState()).data?.content).toHaveLength(2)
    expect(notificationsApi.endpoints.getUnreadCount.select()(store.getState()).data).toBe(2)
  })

  it('un nuovo messaggio nella conversazione già aperta non crea il toast', () => {
    const { store, push } = setup('/chat/c1')
    push(notification({ id: null, type: 'NEW_MESSAGE', targetId: 'c1', preview: 'Ciao' }))

    expect(selectToasts(store.getState())).toEqual([])
  })

  it('un nuovo messaggio di un’altra conversazione, con una aperta, entra', () => {
    const { store, push } = setup('/chat/c1')
    push(notification({ id: null, type: 'NEW_MESSAGE', targetId: 'c2', preview: 'Ciao' }))

    expect(selectToasts(store.getState())).toHaveLength(1)
  })

  it('una richiesta di amicizia ricevuta ha il toast con il testo e il collegamento alle richieste', () => {
    const { push } = setup()
    push(notification({ type: 'FRIEND_REQUEST', targetId: 'f-1' }))

    expect(screen.getByRole('link', { name: 'Giulia Rossi ti ha inviato una richiesta di amicizia' })).toHaveAttribute(
      'href',
      '/amici?scheda=ricevute',
    )
  })

  it('un corpo non valido (senza tipo) viene ignorato', () => {
    const { store, push } = setup()
    push({ foo: 'bar' })

    expect(selectToasts(store.getState())).toEqual([])
  })
})

describe('LiveNotifications · toast', () => {
  const like = {
    id: 'n-1',
    type: 'NEW_LIKE',
    createdAt: '2026-10-22T10:00:00Z',
    actor: { id: 'u1', displayName: 'Giulia Rossi', avatarUrl: null },
    targetId: 'post-1',
    preview: null,
  }

  function setup(path = '/eventi') {
    const store = makeStore()
    store.dispatch(sessionStarted(makeLoginResponse()))
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <LiveNotifications />
        </MemoryRouter>
      </Provider>,
    )
    const push = (body: unknown) => act(() => handlers[QUEUES.notifications](body))
    return { store, push }
  }

  it('un like compare come toast con il testo e un collegamento al feed', () => {
    const { push } = setup()
    push(like)

    expect(screen.getByRole('link', { name: 'Giulia Rossi ha messo mi piace al tuo post' })).toHaveAttribute(
      'href',
      '/feed',
    )
  })

  it('una candidatura porta all’annuncio', () => {
    const { push } = setup()
    push({ ...like, type: 'COLLAB_APPLICATION', targetId: 'annuncio-7' })

    expect(screen.getByRole('link', { name: 'Giulia Rossi si è candidato al tuo annuncio' })).toHaveAttribute(
      'href',
      '/collab/annuncio-7',
    )
  })

  it('un nuovo messaggio mostra l’anteprima e porta alla conversazione', () => {
    const { push } = setup()
    push({ ...like, id: null, type: 'NEW_MESSAGE', targetId: 'c1', preview: 'Ci vediamo alle 20' })

    expect(screen.getByRole('link', { name: 'Nuovo messaggio da Giulia Rossi' })).toHaveAttribute('href', '/chat/c1')
    expect(screen.getByText('Ci vediamo alle 20')).toBeInTheDocument()
  })

  it('l’anteprima passa da UserText: un indirizzo resta un pulsante di conferma, non un collegamento nel collegamento', () => {
    const { push } = setup()
    push({ ...like, id: null, type: 'NEW_MESSAGE', targetId: 'c1', preview: 'Guarda https://esempio.it/x' })

    expect(screen.getByRole('button', { name: 'https://esempio.it/x' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('la X chiude il toast senza segnare letta la notifica', async () => {
    const reads: Request[] = []
    server.use(notificationReadSucceeds(reads))
    const { store, push } = setup()
    push(like)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Chiudi' }))
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(selectToasts(store.getState())).toEqual([])
    expect(reads).toHaveLength(0)
    expect(screen.queryByRole('link', { name: /mi piace/ })).not.toBeInTheDocument()
  })

  it('il clic sul collegamento segna letta quella notifica sul server e chiude il toast', async () => {
    const reads: Request[] = []
    server.use(notificationReadSucceeds(reads))
    const { store, push } = setup()
    push(like)

    await userEvent.setup().click(screen.getByRole('link', { name: /mi piace/ }))

    await waitFor(() => expect(reads).toHaveLength(1))
    expect(new URL(reads[0].url).pathname).toBe('/api/notifications/n-1/read')
    expect(selectToasts(store.getState())).toEqual([])
  })

  it('il clic sul toast di un nuovo messaggio non chiama il server: non è una notifica salvata', async () => {
    const reads: Request[] = []
    server.use(notificationReadSucceeds(reads))
    const { push } = setup()
    push({ ...like, id: null, type: 'NEW_MESSAGE', targetId: 'c1', preview: 'Ciao' })

    await userEvent.setup().click(screen.getByRole('link', { name: 'Nuovo messaggio da Giulia Rossi' }))
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(reads).toHaveLength(0)
  })

  it('si chiude da solo dopo 6 secondi', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { store, push } = setup()
      push(like)

      act(() => void vi.advanceTimersByTime(5_900))
      expect(selectToasts(store.getState())).toHaveLength(1)
      act(() => void vi.advanceTimersByTime(200))
      expect(selectToasts(store.getState())).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('i toast sono al massimo tre insieme', () => {
    const { push } = setup()
    for (let i = 1; i <= 4; i++) push({ ...like, id: `n${i}`, targetId: `p${i}`, actor: { ...like.actor, displayName: `Persona ${i}` } })

    expect(screen.getAllByRole('link', { name: /mi piace/ })).toHaveLength(3)
    expect(screen.queryByText(/Persona 1 ha messo/)).not.toBeInTheDocument()
  })

  it('i toast stanno in una regione che i lettori di schermo leggono senza interrompere', () => {
    const { push } = setup()
    push(like)

    expect(screen.getByRole('status')).toHaveTextContent('Giulia Rossi ha messo mi piace al tuo post')
  })
})

// Le conferme delle azioni («Richiesta inviata») stanno nello stesso riquadro fisso dei toast, in alto a destra, e non
// nel flusso della pagina: così non spostano gli elenchi (scelta dello studente, FE-09b).
describe('LiveNotifications · conferme', () => {
  function setup() {
    const store = makeStore()
    store.dispatch(sessionStarted(makeLoginResponse()))
    render(
      <Provider store={store}>
        <MemoryRouter>
          <LiveNotifications />
        </MemoryRouter>
      </Provider>,
    )
    return store
  }

  it('una conferma compare nel riquadro fisso dei toast', () => {
    const store = setup()
    act(() => {
      store.dispatch(confirmationShown('Richiesta inviata'))
    })

    const confirmation = screen.getByText('Richiesta inviata')
    expect(confirmation.closest('.rs-toasts')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Chiudi' })).toBeInTheDocument()
  })

  it('conferma e toast stanno nello stesso riquadro, uno sotto l’altro', () => {
    const store = setup()
    act(() => {
      store.dispatch(confirmationShown('Richiesta inviata'))
      handlers[QUEUES.notifications]({
        id: 'n-1',
        type: 'NEW_LIKE',
        createdAt: '2026-10-22T10:00:00Z',
        actor: { id: 'u1', displayName: 'Giulia Rossi', avatarUrl: null },
        targetId: 'post-1',
        preview: null,
      })
    })

    const box = screen.getByText('Richiesta inviata').closest('.rs-toasts')
    expect(box).toContainElement(screen.getByRole('link', { name: /mi piace/ }))
  })
})

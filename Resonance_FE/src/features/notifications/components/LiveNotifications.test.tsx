import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionEnded, sessionStarted } from '@/features/auth/authSlice'
import { chatApi } from '@/features/chat/api/chatApi'
import { totalUnread } from '@/features/chat/chatCache'
import { confirmationShown } from '@/lib/notices/confirmationSlice'
import { QUEUES } from '@/lib/stomp/destinations'
import { makeConversation, makeMessage } from '@/test/fixtures/chat'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { conversationsFound } from '@/test/handlers/chat'
import { server } from '@/test/server'
import {
  selectNotifications,
  selectToasts,
  selectUnreadNotificationCount,
} from '../notificationsSlice'
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
})

describe('LiveNotifications · notifiche', () => {
  const notification = (overrides = {}) => ({
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

  it('una notifica arrivata entra nella campanella e nei toast, non letta', () => {
    const { store, push } = setup()
    push(notification())

    expect(selectNotifications(store.getState())).toHaveLength(1)
    expect(selectToasts(store.getState())).toHaveLength(1)
    expect(selectUnreadNotificationCount(store.getState())).toBe(1)
  })

  it('un nuovo messaggio fuori dalla sua conversazione entra come le altre', () => {
    const { store, push } = setup('/feed')
    push(notification({ type: 'NEW_MESSAGE', targetId: 'c1', preview: 'Ciao' }))

    expect(selectToasts(store.getState())).toHaveLength(1)
  })

  it('un nuovo messaggio nella conversazione già aperta non crea né toast né voce', () => {
    const { store, push } = setup('/chat/c1')
    push(notification({ type: 'NEW_MESSAGE', targetId: 'c1', preview: 'Ciao' }))

    expect(selectNotifications(store.getState())).toEqual([])
    expect(selectToasts(store.getState())).toEqual([])
  })

  it('un nuovo messaggio di un’altra conversazione, con una aperta, entra', () => {
    const { store, push } = setup('/chat/c1')
    push(notification({ type: 'NEW_MESSAGE', targetId: 'c2', preview: 'Ciao' }))

    expect(selectToasts(store.getState())).toHaveLength(1)
  })

  it('un corpo non valido (senza tipo) viene ignorato', () => {
    const { store, push } = setup()
    push({ foo: 'bar' })

    expect(selectNotifications(store.getState())).toEqual([])
  })
})

describe('LiveNotifications · toast', () => {
  const like = {
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
    push({ ...like, type: 'NEW_MESSAGE', targetId: 'c1', preview: 'Ci vediamo alle 20' })

    expect(screen.getByRole('link', { name: 'Nuovo messaggio da Giulia Rossi' })).toHaveAttribute('href', '/chat/c1')
    expect(screen.getByText('Ci vediamo alle 20')).toBeInTheDocument()
  })

  it('l’anteprima passa da UserText: un indirizzo resta un pulsante di conferma, non un collegamento nel collegamento', () => {
    const { push } = setup()
    push({ ...like, type: 'NEW_MESSAGE', targetId: 'c1', preview: 'Guarda https://esempio.it/x' })

    expect(screen.getByRole('button', { name: 'https://esempio.it/x' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('la X chiude il toast ma la notifica resta nella campanella', async () => {
    const { store, push } = setup()
    push(like)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Chiudi' }))

    expect(selectToasts(store.getState())).toEqual([])
    expect(selectNotifications(store.getState())).toHaveLength(1)
    expect(screen.queryByRole('link', { name: /mi piace/ })).not.toBeInTheDocument()
  })

  it('il clic sul collegamento segna letta quella notifica e chiude il toast', async () => {
    const { store, push } = setup()
    push(like)

    await userEvent.setup().click(screen.getByRole('link', { name: /mi piace/ }))

    expect(selectUnreadNotificationCount(store.getState())).toBe(0)
    expect(selectToasts(store.getState())).toEqual([])
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
    for (let i = 1; i <= 4; i++) push({ ...like, targetId: `p${i}`, actor: { ...like.actor, displayName: `Persona ${i}` } })

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

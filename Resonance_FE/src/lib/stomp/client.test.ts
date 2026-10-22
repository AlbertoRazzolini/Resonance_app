import { act, renderHook } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { createElement, type ReactNode } from 'react'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { refreshSession } from '@/lib/api/apiSlice'
import { useTokenRenewal } from '@/lib/api/useTokenRenewal'
import { makeLoginResponse } from '@/test/fixtures/users'
import { refreshRejected, refreshSucceeds } from '@/test/handlers/auth'
import { server } from '@/test/server'
import { QUEUES, sendDestination } from './destinations'
import { onStompReconnected, send, startStomp, stopStomp, subscribe } from './client'
import { useStompStatus } from './useStompStatus'

// Il Client di stompjs è simulato: i test guidano a mano connessione, chiusura e frame, e controllano cosa fa il
// nostro codice (token letto a ogni connessione, SUBSCRIBE rifatte, errori della sessione).
type FakeConfig = {
  brokerURL?: string
  reconnectDelay?: number
  beforeConnect?: (client: { connectHeaders: Record<string, string> }) => void | Promise<void>
  onConnect?: (frame: unknown) => void
  onStompError?: (frame: { headers: Record<string, string> }) => void
  onWebSocketClose?: () => void
}

type FakeSubscription = { destination: string; callback: (message: { body: string }) => void; unsubscribe: () => void }

const { FakeClient } = vi.hoisted(() => {
  class FakeClient {
    static instances: FakeClient[] = []
    config: FakeConfig
    connected = false
    active = false
    connectHeaders: Record<string, string> = {}
    subscriptions: FakeSubscription[] = []
    published: { destination: string; body: string }[] = []
    forceDisconnect = vi.fn(() => {
      this.connected = false
      this.config.onWebSocketClose?.()
    })

    constructor(config: FakeConfig) {
      this.config = config
      FakeClient.instances.push(this)
    }
    activate() {
      this.active = true
    }
    async deactivate() {
      this.active = false
      this.connected = false
    }
    subscribe(destination: string, callback: FakeSubscription['callback']) {
      const subscription: FakeSubscription = { destination, callback, unsubscribe: vi.fn() }
      this.subscriptions.push(subscription)
      return subscription
    }
    publish(message: { destination: string; body: string }) {
      this.published.push(message)
    }
  }
  return { FakeClient }
})

vi.mock('@stomp/stompjs', () => ({ Client: FakeClient }))

/** Il client creato da `startStomp`. */
const fake = () => FakeClient.instances[0]

/** Simula una connessione riuscita: `beforeConnect` poi `onConnect`, come fa stompjs a ogni tentativo. */
async function connect() {
  await fake().config.beforeConnect?.(fake())
  fake().connected = true
  act(() => fake().config.onConnect?.({}))
}

/** Messaggio STOMP con corpo JSON su una destinazione. */
const deliver = (destination: string, body: unknown) =>
  fake()
    .subscriptions.filter((s) => s.destination === destination)
    .at(-1)
    ?.callback({ body: JSON.stringify(body) })

function setup() {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse()))
  return store
}

describe('client STOMP', () => {
  beforeEach(() => {
    FakeClient.instances.length = 0
  })
  afterEach(() => {
    stopStomp()
  })

  it('si collega a /ws della stessa origine e riprova ogni 5 secondi', () => {
    startStomp(setup())
    expect(fake().config.brokerURL).toBe(`ws://${window.location.host}/ws`)
    expect(fake().config.reconnectDelay).toBe(5000)
    expect(fake().active).toBe(true)
  })

  it('a ogni connessione legge il token corrente dello store, non quello dell avvio', async () => {
    const store = setup()
    startStomp(store)
    await connect()
    expect(fake().connectHeaders).toEqual({ Authorization: 'Bearer access-1' })

    // Il token cambia mentre la connessione è caduta: il tentativo successivo usa quello nuovo
    server.use(refreshSucceeds(makeLoginResponse({ accessToken: 'access-2' })))
    await refreshSession(store)
    await connect()
    expect(fake().connectHeaders).toEqual({ Authorization: 'Bearer access-2' })
  })

  it('a ogni connessione rifà la SUBSCRIBE alle tre code', async () => {
    startStomp(setup())
    await connect()
    await connect()
    const destinations = fake().subscriptions.map((s) => s.destination)
    for (const queue of [QUEUES.messages, QUEUES.notifications, QUEUES.errors]) {
      expect(destinations.filter((d) => d === queue)).toHaveLength(2)
    }
  })

  it('una iscrizione fatta prima della connessione parte alla connessione e riceve il JSON già letto', async () => {
    startStomp(setup())
    const callback = vi.fn()
    subscribe(QUEUES.messages, callback)
    await connect()
    deliver(QUEUES.messages, { id: 'm1', body: 'ciao' })
    expect(callback).toHaveBeenCalledWith({ id: 'm1', body: 'ciao' })
  })

  it('la funzione restituita annulla l iscrizione: dopo non arriva più nulla', async () => {
    startStomp(setup())
    const callback = vi.fn()
    const unsubscribe = subscribe(QUEUES.messages, callback)
    await connect()
    unsubscribe()
    deliver(QUEUES.messages, { id: 'm1' })
    expect(callback).not.toHaveBeenCalled()
  })

  it('ignora un corpo che non è JSON invece di rompere la coda', async () => {
    startStomp(setup())
    const callback = vi.fn()
    subscribe(QUEUES.messages, callback)
    await connect()
    const subscription = fake().subscriptions.find((s) => s.destination === QUEUES.messages)
    expect(() => subscription?.callback({ body: 'non json' })).not.toThrow()
    expect(callback).not.toHaveBeenCalled()
  })

  it('send risponde false senza connessione e non pubblica niente', () => {
    startStomp(setup())
    expect(send(sendDestination('c1'), { body: 'ciao' })).toBe(false)
    expect(fake().published).toEqual([])
  })

  it('send pubblica il corpo in JSON verso /app/chats/{id}/send quando è connesso', async () => {
    startStomp(setup())
    await connect()
    expect(send(sendDestination('c1'), { body: 'ciao' })).toBe(true)
    expect(fake().published).toEqual([{ destination: '/app/chats/c1/send', body: '{"body":"ciao"}' }])
  })

  it('dopo ogni refresh riuscito forza la riconnessione, così il SEND usa il token nuovo', async () => {
    const store = setup()
    startStomp(store)
    await connect()
    server.use(refreshSucceeds(makeLoginResponse({ accessToken: 'access-2' })))
    await refreshSession(store)
    expect(fake().forceDisconnect).toHaveBeenCalledTimes(1)
  })

  it('TOKEN_INVALID in un frame ERROR: rinnova il token e poi si riconnette con quello nuovo', async () => {
    const store = setup()
    startStomp(store)
    await connect()
    server.use(refreshSucceeds(makeLoginResponse({ accessToken: 'access-2' })))

    fake().config.onStompError?.({ headers: { message: 'TOKEN_INVALID' } })

    await vi.waitFor(() => expect(fake().forceDisconnect).toHaveBeenCalledTimes(1))
    expect(store.getState().auth.accessToken).toBe('access-2')
    await connect()
    expect(fake().connectHeaders).toEqual({ Authorization: 'Bearer access-2' })
  })

  it('TOKEN_INVALID sulla coda errori (dopo un SEND): stesso percorso, refresh e riconnessione', async () => {
    const store = setup()
    startStomp(store)
    await connect()
    server.use(refreshSucceeds(makeLoginResponse({ accessToken: 'access-2' })))

    deliver(QUEUES.errors, { code: 'TOKEN_INVALID', message: 'Token scaduto' })

    await vi.waitFor(() => expect(fake().forceDisconnect).toHaveBeenCalledTimes(1))
    expect(store.getState().auth.accessToken).toBe('access-2')
  })

  it('TOKEN_INVALID con refresh rifiutato chiude la sessione e ferma il client', async () => {
    const store = setup()
    startStomp(store)
    await connect()
    server.use(refreshRejected(401, 'REFRESH_TOKEN_EXPIRED'))

    fake().config.onStompError?.({ headers: { message: 'TOKEN_INVALID' } })

    await vi.waitFor(() => expect(store.getState().auth.status).toBe('anonymous'))
    expect(fake().active).toBe(false)
  })

  it('ACCOUNT_SUSPENDED sulla coda errori: il refresh dà i dettagli e la sessione si chiude con l avviso', async () => {
    const store = setup()
    startStomp(store)
    await connect()
    server.use(
      refreshRejected(403, 'ACCOUNT_SUSPENDED', [], {
        suspensionReason: 'Spam nei messaggi',
        suspendedUntil: '2026-11-01T10:00:00Z',
      }),
    )

    deliver(QUEUES.errors, { code: 'ACCOUNT_SUSPENDED', message: 'Account sospeso' })

    await vi.waitFor(() => expect(store.getState().auth.status).toBe('anonymous'))
    expect(store.getState().auth.suspension).toEqual({
      suspensionReason: 'Spam nei messaggi',
      suspendedUntil: '2026-11-01T10:00:00Z',
    })
    expect(fake().active).toBe(false)
  })

  it('ACCOUNT_SUSPENDED in un frame ERROR (al CONNECT): stessa chiusura con i dettagli', async () => {
    const store = setup()
    startStomp(store)
    server.use(refreshRejected(403, 'ACCOUNT_SUSPENDED', [], { suspensionReason: 'Motivo', suspendedUntil: null }))

    fake().config.onStompError?.({ headers: { message: 'ACCOUNT_SUSPENDED' } })

    await vi.waitFor(() => expect(store.getState().auth.status).toBe('anonymous'))
    expect(store.getState().auth.suspension).toEqual({ suspensionReason: 'Motivo', suspendedUntil: null })
  })

  it('ACCOUNT_SUSPENDED con il refresh che non risponde chiude comunque la sessione, senza motivo', async () => {
    const store = setup()
    startStomp(store)
    await connect()
    server.use(refreshRejected(500, 'INTERNAL_ERROR'))

    deliver(QUEUES.errors, { code: 'ACCOUNT_SUSPENDED', message: 'Account sospeso' })

    await vi.waitFor(() => expect(store.getState().auth.status).toBe('anonymous'))
    expect(store.getState().auth.suspension).toEqual({ suspensionReason: '', suspendedUntil: null })
    expect(fake().active).toBe(false)
  })

  it('un altro codice di errore della coda non tocca la sessione né la connessione', async () => {
    const store = setup()
    startStomp(store)
    await connect()

    deliver(QUEUES.errors, { code: 'TOO_MANY_REQUESTS', message: 'Troppi messaggi' })

    expect(store.getState().auth.status).toBe('authenticated')
    expect(fake().forceDisconnect).not.toHaveBeenCalled()
  })

  it('stopStomp disattiva il client e non reagisce più ai refresh', async () => {
    const store = setup()
    startStomp(store)
    await connect()
    stopStomp()
    expect(fake().active).toBe(false)

    server.use(refreshSucceeds(makeLoginResponse({ accessToken: 'access-2' })))
    await refreshSession(store)
    expect(fake().forceDisconnect).not.toHaveBeenCalled()
  })

  it('onStompReconnected avvisa dalla seconda connessione in poi, non dalla prima', async () => {
    startStomp(setup())
    const listener = vi.fn()
    onStompReconnected(listener)

    await connect()
    expect(listener).not.toHaveBeenCalled()
    await connect()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('lo stato passa da connecting a connected, reconnecting alla caduta e idle allo stop', async () => {
    const { result } = renderHook(() => useStompStatus())
    expect(result.current).toBe('idle')

    act(() => startStomp(setup()))
    expect(result.current).toBe('connecting')

    await connect()
    expect(result.current).toBe('connected')

    act(() => {
      fake().connected = false
      fake().config.onWebSocketClose?.()
    })
    expect(result.current).toBe('reconnecting')

    await connect()
    expect(result.current).toBe('connected')

    act(() => stopStomp())
    expect(result.current).toBe('idle')
  })
})

// Review Focus 7 (piano frontend): dopo 15 minuti di inattività il Principal del backend ha un token scaduto e il
// primo SEND darebbe TOKEN_INVALID. Il rinnovo anticipato (60 s prima) più la riconnessione dopo il refresh fanno sì
// che a quel punto la connessione porti già il token nuovo.
describe('client STOMP · rinnovo anticipato', () => {
  beforeEach(() => {
    FakeClient.instances.length = 0
    // Solo i timer e la data: MSW e fetch continuano a girare in tempo reale
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  })
  afterEach(() => {
    stopStomp()
    vi.useRealTimers()
  })

  it('dopo 15 minuti senza azioni la connessione porta già un token nuovo e ancora valido', async () => {
    const store = makeStore()
    store.dispatch(sessionStarted(makeLoginResponse()))
    // La scadenza del token nuovo si calcola al momento della risposta, come fa il backend
    server.use(
      http.post('*/api/auth/refresh', () =>
        HttpResponse.json(makeLoginResponse({ accessToken: 'access-2' })),
      ),
    )
    startStomp(store)
    renderHook(() => useTokenRenewal(), {
      wrapper: ({ children }: { children: ReactNode }) => createElement(Provider, { store, children }),
    })
    await connect()
    expect(fake().connectHeaders).toEqual({ Authorization: 'Bearer access-1' })

    // Alla scadenza meno 60 secondi il token si rinnova e la connessione viene riaperta
    await vi.advanceTimersByTimeAsync(14 * 60_000 + 1_000)
    await vi.waitFor(() => expect(fake().forceDisconnect).toHaveBeenCalledTimes(1))
    await connect()

    // A 15 minuti e 1 secondo la connessione usa il token nuovo, che scade più avanti
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fake().connectHeaders).toEqual({ Authorization: 'Bearer access-2' })
    expect(Date.parse(store.getState().auth.accessTokenExpiresAt as string)).toBeGreaterThan(Date.now())
  })
})

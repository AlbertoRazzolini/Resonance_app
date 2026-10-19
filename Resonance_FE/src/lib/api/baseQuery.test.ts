import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { server } from '@/test/server'
import { makeLoginResponse } from '@/test/fixtures/users'
import { getErrorMessage } from '@/lib/errors/getErrorMessage'
import { api } from './apiSlice'
import { onTokenRefreshed } from './baseQuery'

// Il client API con refresh silenzioso: un solo refresh per più 401, retry su 409, nessun refresh sugli
// endpoint di auth, chiusura della sessione sui rifiuti definitivi (progettazione, sezioni 4.8 e 4.13).
const protectedApi = api.injectEndpoints({
  endpoints: (build) => ({
    probe: build.query<{ token: string }, number>({ query: (n) => `/api/test/protected/${n}` }),
    badLogin: build.mutation<unknown, void>({
      query: () => ({ url: '/api/auth/login', method: 'POST', body: {} }),
    }),
  }),
})

function errorBody(status: number, code: string, details: Record<string, unknown> = {}) {
  return {
    status,
    code,
    error: 'x',
    message: 'messaggio del backend',
    fields: {},
    details,
    timestamp: '2026-10-19T10:00:00Z',
  }
}

/** Store con una sessione già aperta e token `access-1`. */
function authenticatedStore() {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ accessToken: 'access-1' })))
  return store
}

/** Handler delle richieste protette: accetta solo il token `valid` e restituisce quello ricevuto. */
function protectedHandler(valid: string, seen: string[] = []) {
  return http.get('*/api/test/protected/:n', ({ request }) => {
    const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
    seen.push(token)
    if (token !== valid)
      return HttpResponse.json(errorBody(401, 'UNAUTHENTICATED'), { status: 401 })
    return HttpResponse.json({ token })
  })
}

/** Handler del refresh che risponde con i `responses` in sequenza e conta le chiamate. */
function refreshHandler(responses: Array<() => Response>, calls: Request[] = []) {
  let i = 0
  return http.post('*/api/auth/refresh', ({ request }) => {
    calls.push(request.clone())
    return responses[Math.min(i++, responses.length - 1)]()
  })
}

const ok =
  (token = 'access-2') =>
  () =>
    HttpResponse.json(makeLoginResponse({ accessToken: token }))
const fail = (status: number, code: string, details?: Record<string, unknown>) => () =>
  HttpResponse.json(errorBody(status, code, details), { status })

describe('baseQueryWithReauth', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('su 401 UNAUTHENTICATED fa un refresh e ripete la richiesta con il token nuovo', async () => {
    const seen: string[] = []
    const calls: Request[] = []
    server.use(protectedHandler('access-2', seen), refreshHandler([ok('access-2')], calls))
    const store = authenticatedStore()

    const result = await store.dispatch(protectedApi.endpoints.probe.initiate(1))

    expect(result.data).toEqual({ token: 'access-2' })
    expect(seen).toEqual(['access-1', 'access-2'])
    expect(calls).toHaveLength(1)
    expect(store.getState().auth.accessToken).toBe('access-2')
  })

  it('il refresh invia X-Requested-With e il cookie (credentials include)', async () => {
    const calls: Request[] = []
    server.use(protectedHandler('access-2'), refreshHandler([ok()], calls))
    // Il Request ricevuto da MSW non conserva `credentials`: si guarda quello passato a fetch
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await authenticatedStore().dispatch(protectedApi.endpoints.probe.initiate(1))

    const refreshRequest = fetchSpy.mock.calls
      .map(([input]) => input)
      .find(
        (input): input is Request =>
          input instanceof Request && input.url.endsWith('/api/auth/refresh'),
      )
    expect(refreshRequest?.method).toBe('POST')
    expect(refreshRequest?.credentials).toBe('include')
    expect(calls[0].headers.get('X-Requested-With')).toBe('XMLHttpRequest')
  })

  it('il risultato del refresh non resta nella cache delle mutazioni', async () => {
    server.use(protectedHandler('access-2'), refreshHandler([ok()]))
    const store = authenticatedStore()

    await store.dispatch(protectedApi.endpoints.probe.initiate(1))

    expect(Object.keys(store.getState().api.mutations)).toHaveLength(0)
  })

  it('tre richieste in parallelo con token scaduto provocano un solo refresh', async () => {
    const seen: string[] = []
    const calls: Request[] = []
    server.use(protectedHandler('access-2', seen), refreshHandler([ok()], calls))
    const store = authenticatedStore()

    const results = await Promise.all(
      [1, 2, 3].map((n) => store.dispatch(protectedApi.endpoints.probe.initiate(n))),
    )

    expect(calls).toHaveLength(1)
    expect(results.map((r) => r.data)).toEqual([
      { token: 'access-2' },
      { token: 'access-2' },
      { token: 'access-2' },
    ])
    expect(seen.filter((t) => t === 'access-2')).toHaveLength(3)
  })

  it('su 409 REFRESH_CONFLICT ritenta il refresh una volta e riesce', async () => {
    const calls: Request[] = []
    server.use(
      protectedHandler('access-2'),
      refreshHandler([fail(409, 'REFRESH_CONFLICT'), ok()], calls),
    )
    const store = authenticatedStore()

    const result = await store.dispatch(protectedApi.endpoints.probe.initiate(1))

    expect(calls).toHaveLength(2)
    expect(result.data).toEqual({ token: 'access-2' })
    expect(store.getState().auth.status).toBe('authenticated')
  })

  it('il secondo tentativo dopo un 409 parte dopo circa 1 secondo', async () => {
    const times: number[] = []
    server.use(
      protectedHandler('access-2'),
      http.post('*/api/auth/refresh', () => {
        times.push(Date.now())
        return times.length === 1 ? fail(409, 'REFRESH_CONFLICT')() : ok()()
      }),
    )

    await authenticatedStore().dispatch(protectedApi.endpoints.probe.initiate(1))

    expect(times).toHaveLength(2)
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(950)
  })

  it('due 409 di fila: nessun terzo tentativo, sessione aperta e errore di server non raggiungibile', async () => {
    const calls: Request[] = []
    server.use(protectedHandler('access-2'), refreshHandler([fail(409, 'REFRESH_CONFLICT')], calls))
    const store = authenticatedStore()

    const result = await store.dispatch(protectedApi.endpoints.probe.initiate(1))

    expect(calls).toHaveLength(2)
    expect(result.error).toMatchObject({ status: 'FETCH_ERROR' })
    expect(store.getState().auth.status).toBe('authenticated')
  })

  it('refresh con REFRESH_TOKEN_REUSED: sessione chiusa e cache svuotata', async () => {
    server.use(protectedHandler('access-2'), refreshHandler([fail(401, 'REFRESH_TOKEN_REUSED')]))
    const store = authenticatedStore()

    await store.dispatch(protectedApi.endpoints.probe.initiate(1))

    // Dopo la chiusura la cache è vuota: l'esito della richiesta non si legge più, resta lo stato
    expect(store.getState().auth).toMatchObject({
      status: 'anonymous',
      accessToken: null,
      user: null,
    })
    expect(Object.keys(store.getState().api.queries)).toHaveLength(0)
  })

  it.each(['REFRESH_TOKEN_INVALID', 'REFRESH_TOKEN_EXPIRED'])(
    'refresh con %s chiude la sessione',
    async (code) => {
      server.use(protectedHandler('access-2'), refreshHandler([fail(401, code)]))
      const store = authenticatedStore()
      await store.dispatch(protectedApi.endpoints.probe.initiate(1))
      expect(store.getState().auth.status).toBe('anonymous')
    },
  )

  it('refresh con 403 ACCOUNT_SUSPENDED chiude la sessione conservando i dettagli', async () => {
    const details = { suspensionReason: 'Spam', suspendedUntil: null }
    server.use(
      protectedHandler('access-2'),
      refreshHandler([fail(403, 'ACCOUNT_SUSPENDED', details)]),
    )
    const store = authenticatedStore()

    await store.dispatch(protectedApi.endpoints.probe.initiate(1))

    expect(store.getState().auth.status).toBe('anonymous')
    expect(store.getState().auth.suspension).toEqual(details)
  })

  it('errore 500 sul refresh: la sessione resta aperta e la richiesta riceve "server non raggiungibile", non il 401', async () => {
    server.use(protectedHandler('access-2'), refreshHandler([fail(500, 'INTERNAL_ERROR')]))
    const store = authenticatedStore()
    const result = await store.dispatch(protectedApi.endpoints.probe.initiate(1))
    expect(result.error).toMatchObject({ status: 'FETCH_ERROR' })
    expect(getErrorMessage(result.error)).toMatch(/non raggiungibile/i)
    expect(store.getState().auth.status).toBe('authenticated')
  })

  it('rete assente sul refresh: la sessione resta aperta e la richiesta riceve "server non raggiungibile"', async () => {
    server.use(
      protectedHandler('access-2'),
      http.post('*/api/auth/refresh', () => HttpResponse.error()),
    )
    const store = authenticatedStore()
    const result = await store.dispatch(protectedApi.endpoints.probe.initiate(1))
    expect(result.error).toMatchObject({ status: 'FETCH_ERROR' })
    expect(store.getState().auth.status).toBe('authenticated')
  })

  it('login con password sbagliata (401 INVALID_CREDENTIALS): nessun refresh', async () => {
    const calls: Request[] = []
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(errorBody(401, 'INVALID_CREDENTIALS'), { status: 401 }),
      ),
      refreshHandler([ok()], calls),
    )
    const store = authenticatedStore()

    const result = await store.dispatch(protectedApi.endpoints.badLogin.initiate())

    expect('error' in result && result.error).toMatchObject({ status: 401 })
    expect(calls).toHaveLength(0)
    expect(store.getState().auth.accessToken).toBe('access-1')
  })

  it('un 401 UNAUTHENTICATED senza sessione non prova nessun refresh', async () => {
    const calls: Request[] = []
    server.use(protectedHandler('access-2'), refreshHandler([ok()], calls))
    const store = makeStore()

    const result = await store.dispatch(protectedApi.endpoints.probe.initiate(1))

    expect(result.error).toMatchObject({ status: 401 })
    expect(calls).toHaveLength(0)
  })

  it('un 403 ACCESS_DENIED non attiva il refresh', async () => {
    const calls: Request[] = []
    server.use(
      http.get('*/api/test/protected/:n', () =>
        HttpResponse.json(errorBody(403, 'ACCESS_DENIED'), { status: 403 }),
      ),
      refreshHandler([ok()], calls),
    )
    await authenticatedStore().dispatch(protectedApi.endpoints.probe.initiate(1))
    expect(calls).toHaveLength(0)
  })

  it('se un altro refresh ha già cambiato il token, la richiesta si ripete senza un nuovo refresh', async () => {
    const calls: Request[] = []
    let first = true
    server.use(
      http.get('*/api/test/protected/:n', async ({ request }) => {
        const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
        // La prima risposta 401 arriva dopo che il token nello store è già stato rinnovato
        if (first) {
          first = false
          store.dispatch(sessionStarted(makeLoginResponse({ accessToken: 'access-2' })))
          return HttpResponse.json(errorBody(401, 'UNAUTHENTICATED'), { status: 401 })
        }
        return token === 'access-2'
          ? HttpResponse.json({ token })
          : HttpResponse.json(errorBody(401, 'UNAUTHENTICATED'), { status: 401 })
      }),
      refreshHandler([ok('access-3')], calls),
    )
    const store = authenticatedStore()

    const result = await store.dispatch(protectedApi.endpoints.probe.initiate(1))

    expect(result.data).toEqual({ token: 'access-2' })
    expect(calls).toHaveLength(0)
  })

  it('onTokenRefreshed avvisa i listener a ogni refresh riuscito e si può annullare', async () => {
    server.use(protectedHandler('access-2'), refreshHandler([ok()]))
    const active = vi.fn()
    const cancelled = vi.fn()
    const stop = onTokenRefreshed(cancelled)
    onTokenRefreshed(active)
    stop()

    await authenticatedStore().dispatch(protectedApi.endpoints.probe.initiate(1))

    expect(active).toHaveBeenCalledTimes(1)
    expect(cancelled).not.toHaveBeenCalled()
  })
})

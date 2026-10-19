import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionEnded, sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse } from '@/test/fixtures/users'
import {
  errorResponse,
  loginRejected,
  loginSucceeds,
  logoutSucceeds,
  refreshSucceeds,
} from '@/test/handlers/auth'
import { server } from '@/test/server'
import { authApi } from './authApi'

// Login (POST /api/auth/login): apre la sessione solo se il server accetta le credenziali.
// Logout (DELETE /api/auth/refresh): chiude la sessione, svuota la cache e, se il server non risponde, avvisa l'utente.
function authenticatedStore() {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse()))
  return store
}

describe('authApi · logout', () => {
  it('chiama DELETE /api/auth/refresh con X-Requested-With e chiude la sessione', async () => {
    const calls: Request[] = []
    server.use(logoutSucceeds(calls))
    const store = authenticatedStore()

    await store.dispatch(authApi.endpoints.logout.initiate())

    expect(calls).toHaveLength(1)
    expect(calls[0].headers.get('X-Requested-With')).toBe('XMLHttpRequest')
    expect(store.getState().auth).toMatchObject({
      status: 'anonymous',
      accessToken: null,
      user: null,
    })
    expect(store.getState().notice.current).toBeNull()
  })

  it("se il server risponde con un errore chiude la sessione e mostra l'avviso di uscita incompleta", async () => {
    server.use(
      http.delete('*/api/auth/refresh', () =>
        HttpResponse.json(errorResponse(500, 'INTERNAL_ERROR'), { status: 500 }),
      ),
    )
    const store = authenticatedStore()

    await store.dispatch(authApi.endpoints.logout.initiate())

    expect(store.getState().auth.status).toBe('anonymous')
    expect(store.getState().notice.current).toBe('logoutIncomplete')
  })

  it("con la rete assente chiude la sessione e mostra l'avviso di uscita incompleta", async () => {
    server.use(http.delete('*/api/auth/refresh', () => HttpResponse.error()))
    const store = authenticatedStore()

    await store.dispatch(authApi.endpoints.logout.initiate())

    expect(store.getState().auth.status).toBe('anonymous')
    expect(store.getState().notice.current).toBe('logoutIncomplete')
  })

  it("svuota la cache dei dati dell'utente", async () => {
    server.use(
      logoutSucceeds(),
      http.get('*/api/test/me', () => HttpResponse.json({ ok: true })),
    )
    const store = authenticatedStore()
    const extra = authApi.injectEndpoints({
      endpoints: (build) => ({
        cached: build.query<unknown, void>({ query: () => '/api/test/me' }),
      }),
    })
    await store.dispatch(extra.endpoints.cached.initiate())
    expect(Object.keys(store.getState().api.queries)).toHaveLength(1)

    await store.dispatch(authApi.endpoints.logout.initiate())

    expect(Object.keys(store.getState().api.queries)).toHaveLength(0)
  })
})

describe('authApi · login', () => {
  const credentials = { email: 'fan@example.com', password: 'password-lunga-abbastanza' }

  function anonymousStore() {
    const store = makeStore()
    store.dispatch(sessionEnded())
    return store
  }

  it('invia email e password e apre la sessione con la risposta del server', async () => {
    const calls: Request[] = []
    const login = makeLoginResponse({ accessToken: 'access-del-login' })
    server.use(loginSucceeds(login, calls))
    const store = anonymousStore()

    await store.dispatch(authApi.endpoints.login.initiate(credentials))

    expect(calls).toHaveLength(1)
    expect(await calls[0].json()).toEqual(credentials)
    expect(store.getState().auth).toMatchObject({
      status: 'authenticated',
      accessToken: 'access-del-login',
      user: login.user,
    })
  })

  it('con password sbagliata (401 INVALID_CREDENTIALS) non tenta il refresh e resta anonimo', async () => {
    // Review Focus 1: il refresh parte solo su 401 UNAUTHENTICATED di un endpoint protetto
    const refreshCalls: Request[] = []
    server.use(loginRejected(401, 'INVALID_CREDENTIALS'), refreshSucceeds(undefined, refreshCalls))
    const store = anonymousStore()

    const result = await store.dispatch(authApi.endpoints.login.initiate(credentials))

    expect(result).toHaveProperty('error')
    expect(refreshCalls).toHaveLength(0)
    expect(store.getState().auth).toMatchObject({ status: 'anonymous', accessToken: null, user: null })
  })

  it('con account sospeso (403) non apre la sessione e lascia i dettagli nell\'errore', async () => {
    const details = { suspensionReason: 'Spam', suspendedUntil: null }
    server.use(loginRejected(403, 'ACCOUNT_SUSPENDED', [], details))
    const store = anonymousStore()

    const result = await store.dispatch(authApi.endpoints.login.initiate(credentials))

    expect(result).toMatchObject({ error: { status: 403, data: { code: 'ACCOUNT_SUSPENDED', details } } })
    expect(store.getState().auth.status).toBe('anonymous')
  })
})

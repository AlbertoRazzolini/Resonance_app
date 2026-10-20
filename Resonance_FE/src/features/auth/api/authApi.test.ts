import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionEnded, sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse } from '@/test/fixtures/users'
import {
  errorResponse,
  forgotRejected,
  forgotSucceeds,
  loginRejected,
  loginSucceeds,
  logoutSucceeds,
  refreshSucceeds,
  registerRejected,
  registerSucceeds,
  resendRejected,
  resendSucceeds,
  resetRejected,
  resetSucceeds,
  verifyRejected,
  verifySucceeds,
} from '@/test/handlers/auth'
import { server } from '@/test/server'
import { authApi } from './authApi'

// Registrazione (POST /api/auth/register): non apre la sessione, serve la verifica dell'email.
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
    expect(store.getState().auth).toMatchObject({
      status: 'anonymous',
      accessToken: null,
      user: null,
    })
  })

  it("con account sospeso (403) non apre la sessione e lascia i dettagli nell'errore", async () => {
    const details = { suspensionReason: 'Spam', suspendedUntil: null }
    server.use(loginRejected(403, 'ACCOUNT_SUSPENDED', [], details))
    const store = anonymousStore()

    const result = await store.dispatch(authApi.endpoints.login.initiate(credentials))

    expect(result).toMatchObject({
      error: { status: 403, data: { code: 'ACCOUNT_SUSPENDED', details } },
    })
    expect(store.getState().auth.status).toBe('anonymous')
  })
})

describe('authApi · register', () => {
  const request = {
    email: 'mario@example.com',
    password: 'password-lunga',
    displayName: 'Mario Rossi',
  }

  it('invia i tre campi, riceve la sola email e non apre la sessione', async () => {
    const calls: Request[] = []
    server.use(registerSucceeds(calls))
    const store = makeStore()
    store.dispatch(sessionEnded())

    const result = await store.dispatch(authApi.endpoints.register.initiate(request))

    expect(await calls[0].json()).toEqual(request)
    expect(result).toMatchObject({ data: { email: 'mario@example.com' } })
    expect(store.getState().auth).toMatchObject({
      status: 'anonymous',
      accessToken: null,
      user: null,
    })
  })

  it("con 409 EMAIL_ALREADY_REGISTERED restituisce l'errore senza tentare il refresh", async () => {
    const refreshCalls: Request[] = []
    server.use(
      registerRejected(409, 'EMAIL_ALREADY_REGISTERED'),
      refreshSucceeds(undefined, refreshCalls),
    )
    const store = makeStore()
    store.dispatch(sessionEnded())

    const result = await store.dispatch(authApi.endpoints.register.initiate(request))

    expect(result).toMatchObject({
      error: { status: 409, data: { code: 'EMAIL_ALREADY_REGISTERED' } },
    })
    expect(refreshCalls).toHaveLength(0)
  })
})

describe('authApi · verify', () => {
  const request = { email: 'mario@example.com', code: '482019', password: 'password-lunga' }

  it('invia email, codice e password e apre la sessione con la risposta del server', async () => {
    const calls: Request[] = []
    const login = makeLoginResponse({ accessToken: 'access-della-verifica' })
    server.use(verifySucceeds(login, calls))
    const store = makeStore()
    store.dispatch(sessionEnded())

    await store.dispatch(authApi.endpoints.verify.initiate(request))

    expect(await calls[0].json()).toEqual(request)
    expect(store.getState().auth).toMatchObject({
      status: 'authenticated',
      accessToken: 'access-della-verifica',
      user: login.user,
    })
  })

  it('con CODE_INVALID non apre la sessione e non tenta il refresh', async () => {
    const refreshCalls: Request[] = []
    server.use(verifyRejected(400, 'CODE_INVALID'), refreshSucceeds(undefined, refreshCalls))
    const store = makeStore()
    store.dispatch(sessionEnded())

    const result = await store.dispatch(authApi.endpoints.verify.initiate(request))

    expect(result).toMatchObject({ error: { status: 400, data: { code: 'CODE_INVALID' } } })
    expect(refreshCalls).toHaveLength(0)
    expect(store.getState().auth.status).toBe('anonymous')
  })
})

describe('authApi · resendCode', () => {
  it("invia solo l'email e accetta il 204 senza corpo", async () => {
    const calls: Request[] = []
    server.use(resendSucceeds(calls))
    const store = makeStore()
    store.dispatch(sessionEnded())

    const result = await store.dispatch(
      authApi.endpoints.resendCode.initiate({ email: 'mario@example.com' }),
    )

    expect(await calls[0].json()).toEqual({ email: 'mario@example.com' })
    expect(result).not.toHaveProperty('error')
  })

  it("con 429 TOO_MANY_REQUESTS restituisce l'errore", async () => {
    server.use(resendRejected(429, 'TOO_MANY_REQUESTS'))
    const store = makeStore()
    store.dispatch(sessionEnded())

    const result = await store.dispatch(
      authApi.endpoints.resendCode.initiate({ email: 'mario@example.com' }),
    )

    expect(result).toMatchObject({ error: { status: 429, data: { code: 'TOO_MANY_REQUESTS' } } })
  })
})

describe('authApi · forgotPassword', () => {
  it("invia solo l'email e accetta il 204 senza corpo", async () => {
    const calls: Request[] = []
    server.use(forgotSucceeds(calls))
    const store = makeStore()
    store.dispatch(sessionEnded())

    const result = await store.dispatch(
      authApi.endpoints.forgotPassword.initiate({ email: 'mario@example.com' }),
    )

    expect(await calls[0].json()).toEqual({ email: 'mario@example.com' })
    expect(result).not.toHaveProperty('error')
  })

  it("con 429 TOO_MANY_REQUESTS restituisce l'errore", async () => {
    server.use(forgotRejected(429, 'TOO_MANY_REQUESTS'))
    const store = makeStore()
    store.dispatch(sessionEnded())

    const result = await store.dispatch(
      authApi.endpoints.forgotPassword.initiate({ email: 'mario@example.com' }),
    )

    expect(result).toMatchObject({ error: { status: 429, data: { code: 'TOO_MANY_REQUESTS' } } })
  })
})

describe('authApi · resetPassword', () => {
  const request = { email: 'mario@example.com', code: '482019', newPassword: 'nuova-password-1' }

  it('invia email, codice e nuova password e chiude la sessione (il backend revoca tutti i token)', async () => {
    const calls: Request[] = []
    server.use(resetSucceeds(calls))
    const store = authenticatedStore()

    const result = await store.dispatch(authApi.endpoints.resetPassword.initiate(request))

    expect(await calls[0].json()).toEqual(request)
    expect(result).not.toHaveProperty('error')
    expect(store.getState().auth).toMatchObject({
      status: 'anonymous',
      accessToken: null,
      user: null,
    })
  })

  it('con CODE_INVALID non tocca la sessione e non tenta il refresh', async () => {
    const refreshCalls: Request[] = []
    server.use(resetRejected(400, 'CODE_INVALID'), refreshSucceeds(undefined, refreshCalls))
    const store = authenticatedStore()

    const result = await store.dispatch(authApi.endpoints.resetPassword.initiate(request))

    expect(result).toMatchObject({ error: { status: 400, data: { code: 'CODE_INVALID' } } })
    expect(refreshCalls).toHaveLength(0)
    expect(store.getState().auth.status).toBe('authenticated')
  })
})

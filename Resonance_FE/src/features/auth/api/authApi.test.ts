import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse } from '@/test/fixtures/users'
import { errorResponse, logoutSucceeds } from '@/test/handlers/auth'
import { server } from '@/test/server'
import { authApi } from './authApi'

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

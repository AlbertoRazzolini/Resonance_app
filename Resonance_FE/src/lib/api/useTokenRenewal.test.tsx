import { renderHook } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse } from '@/test/fixtures/users'
import { errorResponse } from '@/test/handlers/auth'
import { server } from '@/test/server'
import { useTokenRenewal } from './useTokenRenewal'

// Rinnovo anticipato: il token si rinnova 60 s prima di accessTokenExpiresAt, senza aspettare un 401; se il
// rinnovo fallisce per un errore passeggero si ritenta una volta dopo 15 s.
describe('useTokenRenewal', () => {
  beforeEach(() => {
    // Solo i timer e la data: MSW e fetch continuano a girare in tempo reale
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** `failFirst`: quante prime risposte del refresh sono un errore 500. */
  function setup(failFirst = 0) {
    let calls = 0
    server.use(
      http.post('*/api/auth/refresh', () => {
        calls++
        if (calls <= failFirst) {
          return HttpResponse.json(errorResponse(500, 'INTERNAL_ERROR'), { status: 500 })
        }
        return HttpResponse.json(makeLoginResponse({ accessToken: `access-${calls + 1}` }))
      }),
    )
    const store = makeStore()
    // Il token scade fra 15 minuti: il rinnovo è atteso dopo 14
    store.dispatch(sessionStarted(makeLoginResponse()))
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    )
    renderHook(() => useTokenRenewal(), { wrapper })
    return { store, calls: () => calls }
  }

  it('non rinnova prima dei 60 secondi dalla scadenza', async () => {
    const { calls } = setup()
    await vi.advanceTimersByTimeAsync(13 * 60_000 + 59_000)
    expect(calls()).toBe(0)
  })

  it('rinnova 60 secondi prima della scadenza e programma il rinnovo successivo', async () => {
    const { store, calls } = setup()

    await vi.advanceTimersByTimeAsync(14 * 60_000 + 1_000)
    await vi.waitFor(() => expect(store.getState().auth.accessToken).toBe('access-2'))
    expect(calls()).toBe(1)

    // Il token nuovo scade fra altri 15 minuti: dopo 14 minuti ne arriva un terzo
    await vi.advanceTimersByTimeAsync(14 * 60_000 + 1_000)
    await vi.waitFor(() => expect(store.getState().auth.accessToken).toBe('access-3'))
    expect(calls()).toBe(2)
  })

  it('se il rinnovo fallisce ritenta una volta dopo 15 secondi', async () => {
    const { store, calls } = setup(1)

    await vi.advanceTimersByTimeAsync(14 * 60_000 + 1_000)
    await vi.waitFor(() => expect(calls()).toBe(1))
    expect(store.getState().auth.accessToken).toBe('access-1')

    // Meno di 15 s: ancora nessun secondo tentativo
    await vi.advanceTimersByTimeAsync(14_000)
    expect(calls()).toBe(1)

    await vi.advanceTimersByTimeAsync(2_000)
    await vi.waitFor(() => expect(store.getState().auth.accessToken).toBe('access-3'))
    expect(calls()).toBe(2)
  })

  it('se anche il secondo tentativo fallisce non ne fa un terzo', async () => {
    const { calls } = setup(5)

    await vi.advanceTimersByTimeAsync(14 * 60_000 + 1_000)
    await vi.waitFor(() => expect(calls()).toBe(1))
    await vi.advanceTimersByTimeAsync(16_000)
    await vi.waitFor(() => expect(calls()).toBe(2))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls()).toBe(2)
  })

  it('senza sessione non programma nulla', async () => {
    let calls = 0
    server.use(
      http.post('*/api/auth/refresh', () => {
        calls++
        return HttpResponse.json({})
      }),
    )
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={makeStore()}>{children}</Provider>
    )
    renderHook(() => useTokenRenewal(), { wrapper })
    await vi.advanceTimersByTimeAsync(60 * 60_000)
    expect(calls).toBe(0)
  })
})

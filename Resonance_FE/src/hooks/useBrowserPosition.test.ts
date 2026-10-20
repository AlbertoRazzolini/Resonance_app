import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBrowserPosition } from './useBrowserPosition'

// Posizione dal browser, chiesta solo quando l'utente lo decide: stati, coordinate e i tre modi in cui può fallire.
type Success = (position: { coords: { latitude: number; longitude: number } }) => void
type Failure = (error: { code: number; PERMISSION_DENIED: number }) => void

function stubGeolocation(getCurrentPosition: (ok: Success, fail: Failure, options?: PositionOptions) => void) {
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  })
}

afterEach(() => {
  // @ts-expect-error: jsdom non ha `geolocation`, si toglie lo stub per i test seguenti
  delete navigator.geolocation
})

describe('useBrowserPosition', () => {
  it('parte da `idle`, senza posizione, e non chiede niente al browser', () => {
    const getCurrentPosition = vi.fn()
    stubGeolocation(getCurrentPosition)

    const { result } = renderHook(() => useBrowserPosition())

    expect(result.current.status).toBe('idle')
    expect(result.current.position).toBeNull()
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('con il permesso restituisce le coordinate, anche nello stato', async () => {
    stubGeolocation((ok) => ok({ coords: { latitude: 44.4949, longitude: 11.3426 } }))
    const { result } = renderHook(() => useBrowserPosition())

    let returned: unknown
    await act(async () => {
      returned = await result.current.request()
    })

    expect(returned).toEqual({ latitude: 44.4949, longitude: 11.3426 })
    expect(result.current.status).toBe('granted')
    expect(result.current.position).toEqual({ latitude: 44.4949, longitude: 11.3426 })
  })

  it('mentre aspetta il browser lo stato è `pending`', async () => {
    let answer: Success = () => {}
    stubGeolocation((ok) => {
      answer = ok
    })
    const { result } = renderHook(() => useBrowserPosition())

    let pending: Promise<unknown> = Promise.resolve()
    act(() => {
      pending = result.current.request()
    })
    expect(result.current.status).toBe('pending')

    await act(async () => {
      answer({ coords: { latitude: 1, longitude: 2 } })
      await pending
    })
    expect(result.current.status).toBe('granted')
  })

  it('con il permesso negato lo stato è `denied` e la risposta è null', async () => {
    stubGeolocation((_ok, fail) => fail({ code: 1, PERMISSION_DENIED: 1 }))
    const { result } = renderHook(() => useBrowserPosition())

    let returned: unknown = 'non chiamata'
    await act(async () => {
      returned = await result.current.request()
    })

    expect(returned).toBeNull()
    expect(result.current.status).toBe('denied')
    expect(result.current.position).toBeNull()
  })

  it.each([
    ['posizione introvabile', 2],
    ['tempo scaduto', 3],
  ])('%s: lo stato è `unavailable`', async (_label, code) => {
    stubGeolocation((_ok, fail) => fail({ code, PERMISSION_DENIED: 1 }))
    const { result } = renderHook(() => useBrowserPosition())

    await act(async () => {
      await result.current.request()
    })

    expect(result.current.status).toBe('unavailable')
  })

  it('in un browser senza geolocalizzazione lo stato è `unavailable`', async () => {
    const { result } = renderHook(() => useBrowserPosition())

    let returned: unknown = 'non chiamata'
    await act(async () => {
      returned = await result.current.request()
    })

    expect(returned).toBeNull()
    expect(result.current.status).toBe('unavailable')
  })

  it('chiede una posizione non precisa, con un tempo massimo (meno batteria sul telefono)', async () => {
    const getCurrentPosition = vi.fn<(ok: Success, fail: Failure, options?: PositionOptions) => void>(
      (ok) => ok({ coords: { latitude: 1, longitude: 2 } }),
    )
    stubGeolocation(getCurrentPosition)
    const { result } = renderHook(() => useBrowserPosition())

    await act(async () => {
      await result.current.request()
    })

    expect(getCurrentPosition.mock.calls[0][2]).toMatchObject({
      enableHighAccuracy: false,
      timeout: 10_000,
    })
  })

  it('un secondo tentativo dopo un rifiuto può riuscire', async () => {
    let denied = true
    stubGeolocation((ok, fail) =>
      denied ? fail({ code: 1, PERMISSION_DENIED: 1 }) : ok({ coords: { latitude: 1, longitude: 2 } }),
    )
    const { result } = renderHook(() => useBrowserPosition())
    await act(async () => {
      await result.current.request()
    })
    expect(result.current.status).toBe('denied')

    denied = false
    await act(async () => {
      await result.current.request()
    })

    expect(result.current.status).toBe('granted')
  })
})

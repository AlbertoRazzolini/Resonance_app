import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { Provider } from 'react-redux'
import { afterEach, describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { DEFAULT_SEARCH_CENTER } from '@/config'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import type { MeResponse } from '@/types/users'
import { DEFAULT_RADIUS_KM, parseRadius, RADIUS_LEVELS, useSearchCenter } from './useSearchCenter'

// Centro della ricerca: posizione del browser (solo dopo la richiesta), poi coordinate del profilo, poi Firenze.
// Raggio: solo i cinque livelli, qualunque altro valore dell'indirizzo torna a quello iniziale.
type Success = (position: { coords: { latitude: number; longitude: number } }) => void
type Failure = (error: { code: number; PERMISSION_DENIED: number }) => void

function stubGeolocation(getCurrentPosition: (ok: Success, fail: Failure) => void) {
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  })
}

afterEach(() => {
  // @ts-expect-error: jsdom non ha `geolocation`, si toglie lo stub per i test seguenti
  delete navigator.geolocation
})

function renderCenter(user: MeResponse | null = null) {
  const store = makeStore()
  if (user) store.dispatch(sessionStarted(makeLoginResponse({ user })))
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(Provider, { store, children })
  return renderHook(() => useSearchCenter(), { wrapper })
}

const BOLOGNA = { latitude: 44.4949, longitude: 11.3426 }
const MILAN = { latitude: 45.4642, longitude: 9.19 }

describe('useSearchCenter', () => {
  it('senza posizione né profilo parte da Firenze, con l\'origine "default"', () => {
    const { result } = renderCenter()

    expect(result.current.source).toBe('default')
    expect(result.current.center).toEqual(DEFAULT_SEARCH_CENTER)
  })

  it('con le coordinate nel profilo parte da quelle, con l\'origine "profile"', () => {
    const { result } = renderCenter(makeMe(BOLOGNA))

    expect(result.current.source).toBe('profile')
    expect(result.current.center).toEqual(BOLOGNA)
  })

  it('un profilo senza coordinate non basta: resta Firenze', () => {
    const { result } = renderCenter(makeMe({ latitude: null, longitude: null }))

    expect(result.current.source).toBe('default')
  })

  it('non chiede la posizione al browser finché l\'utente non preme il pulsante', () => {
    let asked = false
    stubGeolocation(() => {
      asked = true
    })

    renderCenter()

    expect(asked).toBe(false)
  })

  it('dopo la richiesta il centro è la posizione del browser, anche con un profilo', async () => {
    stubGeolocation((ok) => ok({ coords: MILAN }))
    const { result } = renderCenter(makeMe(BOLOGNA))

    await act(async () => {
      await result.current.requestPosition()
    })

    expect(result.current.source).toBe('browser')
    expect(result.current.center).toEqual(MILAN)
  })

  it('se il browser nega il permesso il centro resta quello di prima e lo stato lo dice', async () => {
    stubGeolocation((_ok, fail) => fail({ code: 1, PERMISSION_DENIED: 1 }))
    const { result } = renderCenter(makeMe(BOLOGNA))

    await act(async () => {
      await result.current.requestPosition()
    })

    expect(result.current.positionStatus).toBe('denied')
    expect(result.current.source).toBe('profile')
    expect(result.current.center).toEqual(BOLOGNA)
  })
})

describe('parseRadius', () => {
  it('i livelli sono 5, 15, 25, 50 e 100 km e quello iniziale è 15', () => {
    expect(RADIUS_LEVELS).toEqual([5, 15, 25, 50, 100])
    expect(DEFAULT_RADIUS_KM).toBe(15)
  })

  it.each(RADIUS_LEVELS)('accetta il livello %s', (level) => {
    expect(parseRadius(String(level))).toBe(level)
  })

  it.each([null, '', 'abc', '30', '0', '-5', '1e2', '15.5'])(
    'un valore non valido (%s) torna a 15 km',
    (value) => {
      expect(parseRadius(value)).toBe(15)
    },
  )
})

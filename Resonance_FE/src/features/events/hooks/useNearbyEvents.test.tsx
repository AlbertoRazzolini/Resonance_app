import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { makeConcert, makeIndieEvent, makePage } from '@/test/fixtures/events'
import {
  nearbyConcertsFound,
  nearbyConcertsRejected,
  nearbyIndieFound,
  nearbyIndieRejected,
} from '@/test/handlers/events'
import { server } from '@/test/server'
import { useNearbyEvents, type EventFilter } from './useNearbyEvents'

// Elenco unico dei due tipi nel raggio: filtro «tutti» con le due ricerche unite per distanza, filtri singoli con una
// sola ricerca, «Carica altri» per tipo, totale sommato ed errore di un tipo solo.
const SEARCH = { lat: 43.7696, lng: 11.2558, radiusKm: 15 }

function renderNearby(filter: EventFilter) {
  const store = makeStore()
  return renderHook(() => useNearbyEvents(filter, SEARCH), {
    wrapper: ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>,
  })
}

const ids = (items: { event: { id: string } }[]) => items.map((item) => item.event.id)

describe('useNearbyEvents · tutti', () => {
  it('chiama i due endpoint e unisce i risultati dal più vicino al più lontano', async () => {
    server.use(
      nearbyConcertsFound([makePage([makeConcert({ id: 'c1', distanceKm: 7 }), makeConcert({ id: 'c2', distanceKm: 1 })])]),
      nearbyIndieFound([makePage([makeIndieEvent({ id: 'i1', distanceKm: 3 })])]),
    )

    const { result } = renderNearby('all')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(ids(result.current.items)).toEqual(['c2', 'i1', 'c1'])
    expect(result.current.items.map((item) => item.kind)).toEqual(['official', 'indie', 'official'])
  })

  it('a pari distanza i concerti vengono prima degli indie, e senza distanza si va in fondo', async () => {
    server.use(
      nearbyConcertsFound([makePage([makeConcert({ id: 'c1', distanceKm: 4 }), makeConcert({ id: 'c2', distanceKm: null })])]),
      nearbyIndieFound([makePage([makeIndieEvent({ id: 'i1', distanceKm: 4 })])]),
    )

    const { result } = renderNearby('all')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(ids(result.current.items)).toEqual(['c1', 'i1', 'c2'])
  })

  it('il totale è la somma dei totali dei due tipi, non degli elementi caricati', async () => {
    server.use(
      nearbyConcertsFound([makePage([makeConcert()], { totalElements: 30, totalPages: 2 })]),
      nearbyIndieFound([makePage([makeIndieEvent()], { totalElements: 7 })]),
    )

    const { result } = renderNearby('all')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.totalElements).toBe(37)
  })

  it('è in caricamento finché non arrivano le due risposte', async () => {
    server.use(nearbyConcertsFound([makePage([makeConcert()])]), nearbyIndieFound([makePage([makeIndieEvent()])]))

    const { result } = renderNearby('all')

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.items).toHaveLength(2)
  })
})

describe('useNearbyEvents · filtri singoli', () => {
  it('con «ufficiali» chiama solo i concerti', async () => {
    const indieCalls: Request[] = []
    server.use(nearbyConcertsFound([makePage([makeConcert({ id: 'c1' })])]), nearbyIndieFound([makePage([makeIndieEvent()])], indieCalls))

    const { result } = renderNearby('official')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(ids(result.current.items)).toEqual(['c1'])
    expect(indieCalls).toHaveLength(0)
  })

  it('con «indie» chiama solo gli indie event', async () => {
    const concertCalls: Request[] = []
    server.use(nearbyConcertsFound([makePage([makeConcert()])], concertCalls), nearbyIndieFound([makePage([makeIndieEvent({ id: 'i1' })])]))

    const { result } = renderNearby('indie')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(ids(result.current.items)).toEqual(['i1'])
    expect(concertCalls).toHaveLength(0)
  })
})

describe('useNearbyEvents · Carica altri', () => {
  it('chiede la pagina successiva solo dei tipi che ne hanno ancora, e accoda i risultati', async () => {
    const concertCalls: Request[] = []
    const indieCalls: Request[] = []
    server.use(
      nearbyConcertsFound(
        [
          makePage([makeConcert({ id: 'c1', distanceKm: 1 })], { totalPages: 2, totalElements: 2 }),
          makePage([makeConcert({ id: 'c2', distanceKm: 2 })], { page: 1, totalPages: 2, totalElements: 2 }),
        ],
        concertCalls,
      ),
      nearbyIndieFound([makePage([makeIndieEvent({ id: 'i1', distanceKm: 3 })])], indieCalls),
    )
    const { result } = renderNearby('all')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.hasMore).toBe(true)

    act(() => result.current.loadMore())

    await waitFor(() => expect(ids(result.current.items)).toEqual(['c1', 'c2', 'i1']))
    expect(concertCalls).toHaveLength(2)
    expect(new URL(concertCalls[1].url).searchParams.get('page')).toBe('1')
    expect(indieCalls).toHaveLength(1)
    expect(result.current.hasMore).toBe(false)
  })

  it('con una sola pagina per tipo non c\'è altro da caricare', async () => {
    server.use(nearbyConcertsFound([makePage([makeConcert()])]), nearbyIndieFound([makePage([makeIndieEvent()])]))

    const { result } = renderNearby('all')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.hasMore).toBe(false)
  })
})

describe('useNearbyEvents · errore di un tipo', () => {
  it('se i concerti falliscono gli indie restano, e l\'errore dice quale tipo non si è caricato', async () => {
    server.use(nearbyConcertsRejected(500, 'INTERNAL_ERROR'), nearbyIndieFound([makePage([makeIndieEvent({ id: 'i1' })])]))

    const { result } = renderNearby('all')

    await waitFor(() => expect(result.current.errors).toHaveLength(1))
    expect(result.current.errors[0].kind).toBe('official')
    expect(ids(result.current.items)).toEqual(['i1'])
    expect(result.current.isSuccess).toBe(true)
  })

  it('«Riprova» rifà solo la ricerca fallita', async () => {
    const concertCalls: Request[] = []
    const indieCalls: Request[] = []
    server.use(nearbyConcertsRejected(500, 'INTERNAL_ERROR', concertCalls), nearbyIndieFound([makePage([makeIndieEvent({ id: 'i1' })])], indieCalls))
    const { result } = renderNearby('all')
    await waitFor(() => expect(result.current.errors).toHaveLength(1))

    server.use(nearbyConcertsFound([makePage([makeConcert({ id: 'c1', distanceKm: 1 })])], concertCalls))
    act(() => result.current.errors[0].retry())

    await waitFor(() => expect(result.current.errors).toHaveLength(0))
    expect(ids(result.current.items)).toEqual(['c1', 'i1'])
    expect(indieCalls).toHaveLength(1)
  })

  it('se falliscono entrambi non c\'è alcun risultato e non è un successo', async () => {
    server.use(nearbyConcertsRejected(500, 'INTERNAL_ERROR'), nearbyIndieRejected(500, 'INTERNAL_ERROR'))

    const { result } = renderNearby('all')

    await waitFor(() => expect(result.current.errors).toHaveLength(2))
    expect(result.current.items).toEqual([])
    expect(result.current.isSuccess).toBe(false)
  })
})

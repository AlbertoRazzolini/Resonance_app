import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { makeConcert, makeIndieEvent, makePage } from '@/test/fixtures/events'
import {
  concertCreated,
  concertDeleted,
  concertFound,
  concertRejected,
  indieDeleted,
  indieEventCreated,
  indieEventFound,
  indiePublished,
  myConcertsFound,
  myIndieFound,
  nearbyConcertsFound,
  nearbyConcertsRejected,
  nearbyIndieFound,
} from '@/test/handlers/events'
import { server } from '@/test/server'
import { eventsApi, isEventNotFound } from './eventsApi'

// Endpoint degli eventi: la ricerca vicina manda centro e raggio (e nessuna dimensione di pagina), "Carica altri"
// accoda le pagine nella stessa cache, ogni raggio ha la sua cache; il dettaglio riconosce il 404.
const AROUND_FLORENCE = { lat: 43.7696, lng: 11.2558, radiusKm: 15, page: 0 }

const first = makeConcert({ id: 'c1', title: 'Primo' })
const second = makeConcert({ id: 'c2', title: 'Secondo' })
const third = makeConcert({ id: 'c3', title: 'Terzo' })

describe('eventsApi · concerti vicini', () => {
  it('manda centro, raggio e pagina, senza la dimensione della pagina', async () => {
    const calls: Request[] = []
    server.use(nearbyConcertsFound([makePage([first])], calls))
    const store = makeStore()

    await store.dispatch(eventsApi.endpoints.getNearbyConcerts.initiate(AROUND_FLORENCE))

    const params = new URL(calls[0].url).searchParams
    expect(Object.fromEntries(params)).toEqual({ lat: '43.7696', lng: '11.2558', radiusKm: '15', page: '0' })
  })

  it('"Carica altri" accoda la pagina nuova a quella già caricata', async () => {
    const pages = [makePage([first, second], { totalPages: 2 }), makePage([third], { page: 1, totalPages: 2 })]
    server.use(nearbyConcertsFound(pages))
    const store = makeStore()

    await store.dispatch(eventsApi.endpoints.getNearbyConcerts.initiate(AROUND_FLORENCE))
    await store.dispatch(eventsApi.endpoints.getNearbyConcerts.initiate({ ...AROUND_FLORENCE, page: 1 }))

    const { data } = eventsApi.endpoints.getNearbyConcerts.select({ ...AROUND_FLORENCE, page: 1 })(store.getState())
    expect(data?.content.map((concert) => concert.id)).toEqual(['c1', 'c2', 'c3'])
    expect(data?.page).toBe(1)
  })

  it('rifare la pagina 0 sostituisce l\'elenco invece di accodarlo', async () => {
    server.use(nearbyConcertsFound([makePage([first, second], { totalPages: 2 })]))
    const store = makeStore()
    const subscription = store.dispatch(eventsApi.endpoints.getNearbyConcerts.initiate(AROUND_FLORENCE))
    await subscription

    await subscription.refetch()

    const { data } = eventsApi.endpoints.getNearbyConcerts.select(AROUND_FLORENCE)(store.getState())
    expect(data?.content.map((concert) => concert.id)).toEqual(['c1', 'c2'])
  })

  it('ogni raggio ha la sua cache: tornando a un raggio già visto non si accoda niente', async () => {
    const calls: Request[] = []
    server.use(nearbyConcertsFound([makePage([first])], calls))
    const store = makeStore()

    await store.dispatch(eventsApi.endpoints.getNearbyConcerts.initiate(AROUND_FLORENCE))
    await store.dispatch(eventsApi.endpoints.getNearbyConcerts.initiate({ ...AROUND_FLORENCE, radiusKm: 50 }))

    const at15 = eventsApi.endpoints.getNearbyConcerts.select(AROUND_FLORENCE)(store.getState())
    const at50 = eventsApi.endpoints.getNearbyConcerts.select({ ...AROUND_FLORENCE, radiusKm: 50 })(store.getState())
    expect(calls).toHaveLength(2)
    expect(at15.data?.content).toHaveLength(1)
    expect(at50.data?.content).toHaveLength(1)
  })

  it('concerti e indie event con gli stessi centro e raggio non condividono la cache', async () => {
    server.use(
      nearbyConcertsFound([makePage([first])]),
      nearbyIndieFound([makePage([makeIndieEvent({ title: 'Solo indie' })])]),
    )
    const store = makeStore()

    await store.dispatch(eventsApi.endpoints.getNearbyConcerts.initiate(AROUND_FLORENCE))
    await store.dispatch(eventsApi.endpoints.getNearbyIndieEvents.initiate(AROUND_FLORENCE))

    const concerts = eventsApi.endpoints.getNearbyConcerts.select(AROUND_FLORENCE)(store.getState())
    const indie = eventsApi.endpoints.getNearbyIndieEvents.select(AROUND_FLORENCE)(store.getState())
    expect(concerts.data?.content.map((event) => event.title)).toEqual(['Primo'])
    expect(indie.data?.content.map((event) => event.title)).toEqual(['Solo indie'])
  })

  it('un errore del server arriva come errore, con il codice del backend', async () => {
    server.use(nearbyConcertsRejected(400, 'VALIDATION_ERROR'))
    const store = makeStore()

    const result = await store.dispatch(eventsApi.endpoints.getNearbyConcerts.initiate(AROUND_FLORENCE))

    expect(result.error).toMatchObject({ status: 400, data: { code: 'VALIDATION_ERROR' } })
  })
})

describe('eventsApi · indie event vicini', () => {
  it('usa l\'endpoint degli indie event con gli stessi parametri', async () => {
    const calls: Request[] = []
    server.use(nearbyIndieFound([makePage([makeIndieEvent()])], calls))
    const store = makeStore()

    const result = await store.dispatch(eventsApi.endpoints.getNearbyIndieEvents.initiate(AROUND_FLORENCE))

    expect(new URL(calls[0].url).pathname).toBe('/api/indie-events/nearby')
    expect(result.data?.content[0].title).toBe('Underground night')
  })
})

describe('eventsApi · dettagli', () => {
  it('legge un concerto per id', async () => {
    const calls: Request[] = []
    server.use(concertFound(first, calls))
    const store = makeStore()

    const result = await store.dispatch(eventsApi.endpoints.getConcert.initiate('c1'))

    expect(new URL(calls[0].url).pathname).toBe('/api/official-concerts/c1')
    expect(result.data?.title).toBe('Primo')
  })

  it('legge un indie event per id', async () => {
    const calls: Request[] = []
    server.use(indieEventFound(makeIndieEvent({ id: 'e1' }), calls))
    const store = makeStore()

    await store.dispatch(eventsApi.endpoints.getIndieEvent.initiate('e1'))

    expect(new URL(calls[0].url).pathname).toBe('/api/indie-events/e1')
  })

  it('un 404 con codice NOT_FOUND è "non trovato"', async () => {
    server.use(concertRejected(404, 'NOT_FOUND'))
    const store = makeStore()

    const result = await store.dispatch(eventsApi.endpoints.getConcert.initiate('nascosto'))

    expect(isEventNotFound(result.error)).toBe(true)
  })

  it('un errore del server o della rete non è "non trovato"', async () => {
    server.use(concertRejected(500, 'INTERNAL_ERROR'))
    const store = makeStore()

    const result = await store.dispatch(eventsApi.endpoints.getConcert.initiate('x'))

    expect(isEventNotFound(result.error)).toBe(false)
    expect(isEventNotFound({ status: 'FETCH_ERROR', error: 'boom' })).toBe(false)
    expect(isEventNotFound(undefined)).toBe(false)
  })
})

describe('eventsApi · pubblicazione, elenchi propri e cancellazione', () => {
  const body = {
    title: 'Serata',
    venueName: 'Viper',
    address: 'Via Pistoiese 309, Firenze',
    eventDate: '2099-01-01T20:00:00.000Z',
    genreTags: ['rock'],
  }

  it('createConcert manda POST a /api/official-concerts con il corpo dato', async () => {
    const calls: Request[] = []
    server.use(concertCreated(makeConcert({ id: 'nuovo' }), calls))
    const store = makeStore()

    const result = await store.dispatch(eventsApi.endpoints.createConcert.initiate(body))

    expect(calls[0].method).toBe('POST')
    expect(new URL(calls[0].url).pathname).toBe('/api/official-concerts')
    expect(await calls[0].json()).toEqual(body)
    expect(result.data?.id).toBe('nuovo')
  })

  it('createIndieEvent manda POST a /api/indie-events con isFree e stato', async () => {
    const calls: Request[] = []
    server.use(indieEventCreated(makeIndieEvent({ id: 'ie' }), calls))
    const store = makeStore()

    await store.dispatch(eventsApi.endpoints.createIndieEvent.initiate({ ...body, isFree: true, status: 'DRAFT' }))

    expect(new URL(calls[0].url).pathname).toBe('/api/indie-events')
    expect(await calls[0].json()).toMatchObject({ isFree: true, status: 'DRAFT' })
  })

  it('i miei elenchi chiedono la pagina data a /mine', async () => {
    const concertCalls: Request[] = []
    const indieCalls: Request[] = []
    server.use(
      myConcertsFound([makePage([first]), makePage([second], { page: 1, totalPages: 2 })], concertCalls),
      myIndieFound([makePage([makeIndieEvent()])], indieCalls),
    )
    const store = makeStore()

    await store.dispatch(eventsApi.endpoints.getMyConcerts.initiate(1))
    await store.dispatch(eventsApi.endpoints.getMyIndieEvents.initiate(0))

    expect(new URL(concertCalls[0].url).pathname).toBe('/api/official-concerts/mine')
    expect(new URL(concertCalls[0].url).searchParams.get('page')).toBe('1')
    expect(new URL(indieCalls[0].url).pathname).toBe('/api/indie-events/mine')
  })

  it('ogni pagina di /mine ha la sua voce nella cache', async () => {
    server.use(myConcertsFound([makePage([first], { totalPages: 2 }), makePage([second], { page: 1, totalPages: 2 })]))
    const store = makeStore()

    await store.dispatch(eventsApi.endpoints.getMyConcerts.initiate(0))
    await store.dispatch(eventsApi.endpoints.getMyConcerts.initiate(1))

    expect(eventsApi.endpoints.getMyConcerts.select(0)(store.getState()).data?.content[0].id).toBe('c1')
    expect(eventsApi.endpoints.getMyConcerts.select(1)(store.getState()).data?.content[0].id).toBe('c2')
  })

  it('publishIndieEvent manda PATCH a /publish', async () => {
    const calls: Request[] = []
    server.use(indiePublished(makeIndieEvent({ id: 'd1' }), calls))
    const store = makeStore()

    await store.dispatch(eventsApi.endpoints.publishIndieEvent.initiate('d1'))

    expect(calls[0].method).toBe('PATCH')
    expect(new URL(calls[0].url).pathname).toBe('/api/indie-events/d1/publish')
  })

  it("la cancellazione manda il motivo nel body solo se c'è", async () => {
    const calls: Request[] = []
    server.use(concertDeleted(calls), indieDeleted(calls))
    const store = makeStore()

    await store.dispatch(eventsApi.endpoints.deleteConcert.initiate({ id: 'c1', reason: 'Errore' }))
    await store.dispatch(eventsApi.endpoints.deleteIndieEvent.initiate({ id: 'e1' }))
    await store.dispatch(eventsApi.endpoints.deleteIndieEvent.initiate({ id: 'e2', reason: '' }))

    expect(calls.map((call) => call.method)).toEqual(['DELETE', 'DELETE', 'DELETE'])
    expect(await calls[0].json()).toEqual({ reason: 'Errore' })
    expect(await calls[1].text()).toBe('')
    expect(await calls[2].text()).toBe('')
  })
})

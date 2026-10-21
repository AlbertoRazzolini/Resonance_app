import { describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import { makePage } from '@/test/fixtures/events'
import { makeFeedPost } from '@/test/fixtures/feed'
import {
  feedFound,
  likeRemoved,
  likeRemovedRejected,
  likeSet,
  likeSetRejected,
  myPostsFound,
  postCreated,
  postDeleted,
} from '@/test/handlers/feed'
import { server } from '@/test/server'
import { feedApi } from './feedApi'

// Endpoint del feed: il filtro manda i tre parametri o nessuno; creazione e cancellazione rileggono gli elenchi; il like
// cambia subito i post in cache (feed e «Post» dell'area personale) e torna com'era se il server risponde con un errore.
const NO_FILTER = { page: 0 }
const AROUND_FLORENCE = { lat: 43.7696, lng: 11.2558, radiusKm: 15, page: 0 }

const post = makeFeedPost({ id: 'p1', likesCount: 3, likedByMe: false })

/** Post `id` come lo vede la cache del feed (pagina 0 senza filtro). */
function cachedFeedPost(store: ReturnType<typeof makeStore>, id = 'p1') {
  return feedApi.endpoints.getFeed.select(NO_FILTER)(store.getState()).data?.content.find((item) => item.id === id)
}

/** Post `id` come lo vede la cache della scheda «Post» (pagina 0). */
function cachedMinePost(store: ReturnType<typeof makeStore>, id = 'p1') {
  return feedApi.endpoints.getMyPosts.select(0)(store.getState()).data?.content.find((item) => item.id === id)
}

describe('feedApi · elenco', () => {
  it('senza filtro manda solo la pagina', async () => {
    const calls: Request[] = []
    server.use(feedFound([makePage([post])], calls))
    const store = makeStore()

    await store.dispatch(feedApi.endpoints.getFeed.initiate(NO_FILTER))

    expect(Object.fromEntries(new URL(calls[0].url).searchParams)).toEqual({ page: '0' })
  })

  it('con il filtro manda centro, raggio e pagina insieme, senza la dimensione della pagina', async () => {
    const calls: Request[] = []
    server.use(feedFound([makePage([post])], calls))
    const store = makeStore()

    await store.dispatch(feedApi.endpoints.getFeed.initiate(AROUND_FLORENCE))

    expect(Object.fromEntries(new URL(calls[0].url).searchParams)).toEqual({
      lat: '43.7696',
      lng: '11.2558',
      radiusKm: '15',
      page: '0',
    })
  })

  it('«Post» dell\'area personale chiede la pagina a /mine', async () => {
    const calls: Request[] = []
    server.use(myPostsFound([makePage([post]), makePage([], { page: 1 })], calls))
    const store = makeStore()

    await store.dispatch(feedApi.endpoints.getMyPosts.initiate(1))

    const url = new URL(calls[0].url)
    expect(url.pathname).toBe('/api/feed-posts/mine')
    expect(url.searchParams.get('page')).toBe('1')
  })
})

describe('feedApi · creazione e cancellazione', () => {
  it('createPost manda il corpo e rilegge feed e scheda «Post»', async () => {
    const feedCalls: Request[] = []
    const mineCalls: Request[] = []
    const createCalls: Request[] = []
    server.use(
      feedFound([makePage([post])], feedCalls),
      myPostsFound([makePage([post])], mineCalls),
      postCreated(makeFeedPost({ id: 'new' }), createCalls),
    )
    const store = makeStore()
    store.dispatch(feedApi.endpoints.getFeed.initiate(NO_FILTER))
    store.dispatch(feedApi.endpoints.getMyPosts.initiate(0))
    await vi.waitFor(() => expect(feedCalls).toHaveLength(1))
    await vi.waitFor(() => expect(mineCalls).toHaveLength(1))

    await store.dispatch(
      feedApi.endpoints.createPost.initiate({ body: 'Ciao', imageUrl: 'https://example.com/a.png', latitude: 43.7, longitude: 11.2 }),
    )

    expect(await createCalls[0].json()).toEqual({
      body: 'Ciao',
      imageUrl: 'https://example.com/a.png',
      latitude: 43.7,
      longitude: 11.2,
    })
    await vi.waitFor(() => expect(feedCalls).toHaveLength(2))
    await vi.waitFor(() => expect(mineCalls).toHaveLength(2))
  })

  it('deletePost fa DELETE sul post e rilegge feed e scheda «Post»', async () => {
    const feedCalls: Request[] = []
    const mineCalls: Request[] = []
    const deleteCalls: Request[] = []
    server.use(
      feedFound([makePage([post])], feedCalls),
      myPostsFound([makePage([post])], mineCalls),
      postDeleted(deleteCalls),
    )
    const store = makeStore()
    store.dispatch(feedApi.endpoints.getFeed.initiate(NO_FILTER))
    store.dispatch(feedApi.endpoints.getMyPosts.initiate(0))
    await vi.waitFor(() => expect(feedCalls).toHaveLength(1))
    await vi.waitFor(() => expect(mineCalls).toHaveLength(1))

    await store.dispatch(feedApi.endpoints.deletePost.initiate('p1'))

    expect(deleteCalls[0].method).toBe('DELETE')
    expect(new URL(deleteCalls[0].url).pathname).toBe('/api/feed-posts/p1')
    await vi.waitFor(() => expect(feedCalls).toHaveLength(2))
    await vi.waitFor(() => expect(mineCalls).toHaveLength(2))
  })
})

describe('feedApi · like ottimistico', () => {
  /** Store con il post in cache sia nel feed sia nella scheda «Post». */
  async function storeWithCachedPost() {
    const store = makeStore()
    store.dispatch(feedApi.endpoints.getFeed.initiate(NO_FILTER))
    store.dispatch(feedApi.endpoints.getMyPosts.initiate(0))
    await vi.waitFor(() => expect(cachedFeedPost(store)).toBeDefined())
    await vi.waitFor(() => expect(cachedMinePost(store)).toBeDefined())
    return store
  }

  it('il like cambia subito il post in feed e in «Post», prima della risposta', async () => {
    server.use(
      feedFound([makePage([post])]),
      myPostsFound([makePage([post])]),
      likeSet({ likesCount: 4, likedByMe: true }, [], 200),
    )
    const store = await storeWithCachedPost()

    const request = store.dispatch(feedApi.endpoints.likePost.initiate({ id: 'p1', liked: true }))

    await vi.waitFor(() => expect(cachedFeedPost(store)).toMatchObject({ likedByMe: true, likesCount: 4 }))
    expect(cachedMinePost(store)).toMatchObject({ likedByMe: true, likesCount: 4 })
    await request
  })

  it('a risposta arrivata il post prende i numeri veri del server', async () => {
    // Un altro utente ha messo like nel frattempo: il server dice 10, non 4
    server.use(feedFound([makePage([post])]), myPostsFound([makePage([post])]), likeSet({ likesCount: 10, likedByMe: true }))
    const store = await storeWithCachedPost()

    await store.dispatch(feedApi.endpoints.likePost.initiate({ id: 'p1', liked: true }))

    expect(cachedFeedPost(store)).toMatchObject({ likedByMe: true, likesCount: 10 })
    expect(cachedMinePost(store)).toMatchObject({ likedByMe: true, likesCount: 10 })
  })

  it('togliere il like usa DELETE e scala il contatore subito', async () => {
    const calls: Request[] = []
    const liked = makeFeedPost({ id: 'p1', likesCount: 3, likedByMe: true })
    server.use(
      feedFound([makePage([liked])]),
      myPostsFound([makePage([liked])]),
      likeRemoved({ likesCount: 2, likedByMe: false }, calls, 200),
    )
    const store = await storeWithCachedPost()

    const request = store.dispatch(feedApi.endpoints.likePost.initiate({ id: 'p1', liked: false }))

    await vi.waitFor(() => expect(cachedFeedPost(store)).toMatchObject({ likedByMe: false, likesCount: 2 }))
    await request
    expect(calls[0].method).toBe('DELETE')
  })

  it('con un errore del server il like viene annullato: feed e «Post» tornano come prima', async () => {
    server.use(
      feedFound([makePage([post])]),
      myPostsFound([makePage([post])]),
      likeSetRejected(500, 'INTERNAL_ERROR', [], 100),
    )
    const store = await storeWithCachedPost()

    const request = store.dispatch(feedApi.endpoints.likePost.initiate({ id: 'p1', liked: true }))
    await vi.waitFor(() => expect(cachedFeedPost(store)).toMatchObject({ likedByMe: true, likesCount: 4 }))
    const result = await request

    expect('error' in result).toBe(true)
    expect(cachedFeedPost(store)).toMatchObject({ likedByMe: false, likesCount: 3 })
    expect(cachedMinePost(store)).toMatchObject({ likedByMe: false, likesCount: 3 })
  })

  it('anche il «Non mi piace più» respinto torna com\'era', async () => {
    const liked = makeFeedPost({ id: 'p1', likesCount: 3, likedByMe: true })
    server.use(
      feedFound([makePage([liked])]),
      myPostsFound([makePage([liked])]),
      likeRemovedRejected(404, 'NOT_FOUND', [], 100),
    )
    const store = await storeWithCachedPost()

    await store.dispatch(feedApi.endpoints.likePost.initiate({ id: 'p1', liked: false }))

    expect(cachedFeedPost(store)).toMatchObject({ likedByMe: true, likesCount: 3 })
  })

  it('un like su un post che non è in cache non fa errori', async () => {
    server.use(likeSet({ likesCount: 1, likedByMe: true }))
    const store = makeStore()

    const result = await store.dispatch(feedApi.endpoints.likePost.initiate({ id: 'altro', liked: true }))

    expect('data' in result).toBe(true)
  })
})

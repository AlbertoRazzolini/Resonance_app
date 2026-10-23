import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeFriendship } from '@/test/fixtures/friends'
import { makeLoginResponse } from '@/test/fixtures/users'
import {
  friendshipRequested,
  friendshipStateFound,
  friendshipStateRejected,
} from '@/test/handlers/friends'
import { server } from '@/test/server'
import { friendsApi } from './friendsApi'

// Stato dell'amicizia con un utente (decisione 102): lettura per il profilo, riletta dopo ogni azione sulle amicizie.
function authenticatedStore() {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse()))
  return store
}

describe('friendsApi · GET /api/friendships/with/{userId}', () => {
  it('chiede lo stato dell\'id nell\'indirizzo, codificato, e restituisce il corpo', async () => {
    const calls: Request[] = []
    server.use(friendshipStateFound({ status: 'INCOMING', friendshipId: 'f1' }, calls))
    const store = authenticatedStore()

    const result = await store.dispatch(friendsApi.endpoints.getFriendshipWith.initiate('id-con/barra'))

    expect(new URL(calls[0].url).pathname).toBe('/api/friendships/with/id-con%2Fbarra')
    expect(result.data).toEqual({ status: 'INCOMING', friendshipId: 'f1' })
  })

  it('con un errore restituisce l\'errore', async () => {
    server.use(friendshipStateRejected(429, 'TOO_MANY_REQUESTS'))
    const store = authenticatedStore()

    const result = await store.dispatch(friendsApi.endpoints.getFriendshipWith.initiate('u1'))

    expect(result).toHaveProperty('error')
  })

  it('dopo una richiesta di amicizia lo stato si rilegge', async () => {
    const calls: Request[] = []
    server.use(
      friendshipStateFound({ status: 'NONE', friendshipId: null }, calls),
      friendshipRequested(makeFriendship({ status: 'OUTGOING' })),
    )
    const store = authenticatedStore()
    const subscription = store.dispatch(friendsApi.endpoints.getFriendshipWith.initiate('u1'))
    await subscription

    await store.dispatch(friendsApi.endpoints.requestFriendship.initiate('u1'))

    await expect.poll(() => calls.length).toBe(2)
    subscription.unsubscribe()
  })
})

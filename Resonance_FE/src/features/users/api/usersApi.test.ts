import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe, makePublicUser } from '@/test/fixtures/users'
import {
  locationRemoved,
  profileRejected,
  profileUpdated,
  publicUserFound,
  publicUserRejected,
  roleActivated,
} from '@/test/handlers/users'
import { server } from '@/test/server'
import { usersApi } from './usersApi'

// Endpoint degli utenti: le risposte con il profilo aggiornano la sessione (`userUpdated`), il profilo pubblico si legge a parte.
function authenticatedStore(user = makeMe()) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ user })))
  return store
}

describe('usersApi · PATCH /api/users/me', () => {
  it('invia il corpo ricevuto e mette il profilo della risposta nella sessione', async () => {
    const calls: Request[] = []
    server.use(profileUpdated(makeMe(), calls))
    const store = authenticatedStore()

    await store.dispatch(usersApi.endpoints.updateProfile.initiate({ city: 'Bologna' }))

    expect(await calls[0].json()).toEqual({ city: 'Bologna' })
    expect(store.getState().auth.user?.city).toBe('Bologna')
  })

  it('con un errore lascia la sessione com\'è e restituisce l\'errore', async () => {
    server.use(profileRejected(400, 'VALIDATION_ERROR', { displayName: 'Non valido' }))
    const store = authenticatedStore(makeMe({ displayName: 'Prima' }))

    const result = await store.dispatch(usersApi.endpoints.updateProfile.initiate({ displayName: 'x' }))

    expect(result).toHaveProperty('error')
    expect(store.getState().auth.user?.displayName).toBe('Prima')
  })
})

describe('usersApi · DELETE /api/users/me/location', () => {
  it('toglie le coordinate dalla sessione con il profilo della risposta', async () => {
    const calls: Request[] = []
    const me = makeMe({ latitude: 44.49, longitude: 11.34 })
    server.use(locationRemoved(me, calls))
    const store = authenticatedStore(me)

    await store.dispatch(usersApi.endpoints.removeLocation.initiate())

    expect(calls).toHaveLength(1)
    expect(store.getState().auth.user).toMatchObject({ latitude: null, longitude: null })
  })
})

describe('usersApi · attivazione dei ruoli', () => {
  it.each(['musician', 'host'] as const)('POST /api/users/me/roles/%s aggiorna i ruoli nella sessione', async (role) => {
    const calls: Request[] = []
    const upper = role.toUpperCase() as 'MUSICIAN' | 'HOST'
    server.use(roleActivated(makeMe({ roles: ['FAN', upper] }), calls))
    const store = authenticatedStore()

    await store.dispatch(usersApi.endpoints.activateRole.initiate(role))

    expect(new URL(calls[0].url).pathname).toBe(`/api/users/me/roles/${role}`)
    expect(store.getState().auth.user?.roles).toEqual(['FAN', upper])
  })
})

describe('usersApi · GET /api/users/{id}', () => {
  it('legge il profilo pubblico', async () => {
    server.use(publicUserFound(makePublicUser({ displayName: 'Chitarrista' })))
    const store = makeStore()

    const result = await store.dispatch(usersApi.endpoints.getPublicUser.initiate('abc'))

    expect(result.data?.displayName).toBe('Chitarrista')
  })

  it('un utente che non esiste dà un errore con il codice del backend', async () => {
    server.use(publicUserRejected(404, 'NOT_FOUND'))
    const store = makeStore()

    const result = await store.dispatch(usersApi.endpoints.getPublicUser.initiate('abc'))

    expect(result.error).toMatchObject({ status: 404 })
  })
})

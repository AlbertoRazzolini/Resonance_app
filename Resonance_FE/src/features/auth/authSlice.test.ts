import { describe, expect, it } from 'vitest'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import {
  authReducer,
  selectCurrentUser,
  selectHasRole,
  sessionEnded,
  sessionStarted,
  tokenRefreshed,
  userUpdated,
  type AuthState,
} from './authSlice'

// Transizioni dell'authSlice (stato della sessione, token solo in memoria) e selettori di ruolo.
const unknown: AuthState = authReducer(undefined, { type: 'init' })
const wrap = (auth: AuthState) => ({ auth })

describe('authSlice', () => {
  it('parte con stato unknown, senza token né utente', () => {
    expect(unknown).toEqual({
      status: 'unknown',
      accessToken: null,
      accessTokenExpiresAt: null,
      user: null,
      suspension: null,
    })
  })

  it('sessionStarted apre la sessione con token, scadenza e utente', () => {
    const login = makeLoginResponse()
    const state = authReducer(unknown, sessionStarted(login))
    expect(state.status).toBe('authenticated')
    expect(state.accessToken).toBe(login.accessToken)
    expect(state.accessTokenExpiresAt).toBe(login.accessTokenExpiresAt)
    expect(state.user).toEqual(login.user)
  })

  it("tokenRefreshed cambia token e scadenza e aggiorna l'utente", () => {
    const started = authReducer(unknown, sessionStarted(makeLoginResponse()))
    const next = makeLoginResponse({
      accessToken: 'nuovo',
      user: makeMe({ displayName: 'Nuovo nome' }),
    })
    const state = authReducer(started, tokenRefreshed(next))
    expect(state.accessToken).toBe('nuovo')
    expect(state.user?.displayName).toBe('Nuovo nome')
    expect(state.status).toBe('authenticated')
  })

  it("userUpdated sostituisce solo l'utente", () => {
    const started = authReducer(unknown, sessionStarted(makeLoginResponse()))
    const state = authReducer(started, userUpdated(makeMe({ city: 'Torino' })))
    expect(state.user?.city).toBe('Torino')
    expect(state.accessToken).toBe(started.accessToken)
  })

  it('sessionEnded porta ad anonymous e cancella il token', () => {
    const started = authReducer(unknown, sessionStarted(makeLoginResponse()))
    const state = authReducer(started, sessionEnded())
    expect(state).toEqual({
      status: 'anonymous',
      accessToken: null,
      accessTokenExpiresAt: null,
      user: null,
      suspension: null,
    })
  })

  it('sessionEnded con i dettagli di sospensione li conserva', () => {
    const started = authReducer(unknown, sessionStarted(makeLoginResponse()))
    const suspension = { suspensionReason: 'Spam', suspendedUntil: null }
    const state = authReducer(started, sessionEnded({ suspension }))
    expect(state.status).toBe('anonymous')
    expect(state.suspension).toEqual(suspension)
  })

  it('un nuovo sessionStarted azzera la sospensione precedente', () => {
    const ended = authReducer(
      unknown,
      sessionEnded({ suspension: { suspensionReason: 'Spam', suspendedUntil: null } }),
    )
    expect(authReducer(ended, sessionStarted(makeLoginResponse())).suspension).toBeNull()
  })

  it("selectCurrentUser restituisce l'utente o null", () => {
    expect(selectCurrentUser(wrap(unknown))).toBeNull()
    const started = authReducer(unknown, sessionStarted(makeLoginResponse()))
    expect(selectCurrentUser(wrap(started))?.id).toBe(started.user?.id)
  })

  it('selectHasRole: un FAN non è ADMIN, un SUPERADMIN vale anche come ADMIN', () => {
    const fan = authReducer(
      unknown,
      sessionStarted(makeLoginResponse({ user: makeMe({ roles: ['FAN'] }) })),
    )
    expect(selectHasRole('FAN')(wrap(fan))).toBe(true)
    expect(selectHasRole('ADMIN')(wrap(fan))).toBe(false)
    const superadmin = authReducer(
      unknown,
      sessionStarted(makeLoginResponse({ user: makeMe({ roles: ['SUPERADMIN'] }) })),
    )
    expect(selectHasRole('ADMIN')(wrap(superadmin))).toBe(true)
    expect(selectHasRole('MUSICIAN')(wrap(superadmin))).toBe(false)
    expect(selectHasRole('ADMIN')(wrap(unknown))).toBe(false)
  })
})

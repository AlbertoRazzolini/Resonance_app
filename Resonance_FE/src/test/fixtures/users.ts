import type { LoginResponse, MeResponse } from '@/types/users'

/** Profilo di prova (un FAN attivo); `overrides` cambia i campi che interessano al test. */
export function makeMe(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'fan@example.com',
    displayName: 'Fan di prova',
    avatarUrl: null,
    bio: null,
    city: null,
    latitude: null,
    longitude: null,
    roles: ['FAN'],
    status: 'ACTIVE',
    createdAt: '2026-10-01T10:00:00Z',
    ...overrides,
  }
}

/** Risposta di login/refresh di prova; il token scade fra 15 minuti, come in produzione. */
export function makeLoginResponse(overrides: Partial<LoginResponse> = {}): LoginResponse {
  return {
    accessToken: 'access-1',
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    user: makeMe(),
    ...overrides,
  }
}

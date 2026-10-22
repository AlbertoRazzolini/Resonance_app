import type { AdminUserResponse, HiddenContentResponse } from '@/types/admin'

/** Utente di prova visto da un admin (un FAN attivo e verificato); `overrides` cambia i campi che interessano al test. */
export function makeAdminUser(overrides: Partial<AdminUserResponse> = {}): AdminUserResponse {
  return {
    id: 'a0000000-0000-0000-0000-000000000001',
    email: 'marco@example.com',
    displayName: 'Marco Rossi',
    roles: ['FAN'],
    status: 'ACTIVE',
    emailVerified: true,
    createdAt: '2026-10-01T10:00:00Z',
    suspendedAt: null,
    suspendedBy: null,
    suspensionReason: null,
    suspendedUntil: null,
    ...overrides,
  }
}

/** Contenuto nascosto di prova (da un admin, con motivo); `overrides` cambia i campi che interessano al test. */
export function makeHiddenContent(overrides: Partial<HiddenContentResponse> = {}): HiddenContentResponse {
  return {
    id: 'b0000000-0000-0000-0000-000000000001',
    author: { id: '55555555-5555-5555-5555-555555555555', displayName: 'Anna Bianchi', avatarUrl: null },
    title: 'Serata contestata',
    hiddenAt: '2026-10-20T09:00:00Z',
    hiddenBy: '66666666-6666-6666-6666-666666666666',
    hiddenReason: 'Contenuto offensivo',
    deletedByOwner: false,
    ...overrides,
  }
}

import type { FriendshipResponse, UserSearchResult } from '@/types/friends'

/** Risultato di ricerca di prova (nessuna amicizia); `overrides` cambia i campi che interessano al test. */
export function makeSearchResult(overrides: Partial<UserSearchResult> = {}): UserSearchResult {
  return {
    id: '33333333-3333-3333-3333-333333333333',
    displayName: 'Mario Rossi',
    avatarUrl: null,
    city: 'Firenze',
    friendship: { status: 'NONE', friendshipId: null },
    ...overrides,
  }
}

/** Amicizia di prova (accettata); `overrides` cambia i campi che interessano al test. */
export function makeFriendship(overrides: Partial<FriendshipResponse> = {}): FriendshipResponse {
  return {
    id: 'f0000000-0000-0000-0000-000000000001',
    otherUser: { id: '44444444-4444-4444-4444-444444444444', displayName: 'Giulia Verdi', avatarUrl: null },
    status: 'FRIENDS',
    updatedAt: '2026-10-21T10:00:00Z',
    ...overrides,
  }
}

import type { CollabPostResponse } from '@/types/collab'

/** Annuncio collab di prova (aperto); `overrides` cambia i campi che interessano al test. */
export function makeCollabPost(overrides: Partial<CollabPostResponse> = {}): CollabPostResponse {
  return {
    id: 'a0000000-0000-0000-0000-000000000001',
    musician: { id: '55555555-5555-5555-5555-555555555555', displayName: 'Veleno Rosa', avatarUrl: null },
    title: 'Cercasi bassista per progetto post-rock',
    description: 'Cerchiamo un elemento solido.\nAbbiamo cinque pezzi pronti.',
    roleNeeded: 'Bassista',
    genreTags: ['post-rock', 'noise'],
    location: 'Milano (NoLo)',
    isOpen: true,
    createdAt: '2026-10-20T10:00:00Z',
    applicationConversationId: null,
    ...overrides,
  }
}

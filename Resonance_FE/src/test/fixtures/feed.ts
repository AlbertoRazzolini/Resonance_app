import type { FeedPostResponse } from '@/types/feed'

/** Post di prova (di un altro autore, senza immagine né posizione); `overrides` cambia i campi che interessano al test. */
export function makeFeedPost(overrides: Partial<FeedPostResponse> = {}): FeedPostResponse {
  return {
    id: 'f0000000-0000-0000-0000-000000000001',
    author: { id: '22222222-2222-2222-2222-222222222222', displayName: 'Altro utente', avatarUrl: null },
    body: 'Stasera suono al Viper!',
    imageUrl: null,
    latitude: null,
    longitude: null,
    likesCount: 3,
    likedByMe: false,
    createdAt: '2026-10-20T18:30:00Z',
    distanceKm: null,
    ...overrides,
  }
}

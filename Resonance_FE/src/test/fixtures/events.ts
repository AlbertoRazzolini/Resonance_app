import type { PageResponse } from '@/types/common'
import type { IndieEventResponse, OfficialConcertResponse } from '@/types/events'

/** Concerto ufficiale di prova (a Firenze); `overrides` cambia i campi che interessano al test. */
export function makeConcert(overrides: Partial<OfficialConcertResponse> = {}): OfficialConcertResponse {
  return {
    id: 'c0000000-0000-0000-0000-000000000001',
    host: { id: '33333333-3333-3333-3333-333333333333', displayName: 'Viper Theatre', avatarUrl: null },
    title: 'Soviet Soviet + Leatherette',
    description: 'Una serata post-punk.\nPorte alle 21.',
    venueName: 'Viper Theatre',
    address: 'Via Pistoiese 309, Firenze',
    latitude: 43.7993,
    longitude: 11.2095,
    eventDate: '2026-11-20T20:30:00Z',
    genreTags: ['post-punk', 'new wave'],
    coverImageUrl: null,
    externalTicketUrl: 'https://www.ticketone.it/evento/soviet-soviet',
    createdAt: '2026-10-01T10:00:00Z',
    distanceKm: 3.2,
    ...overrides,
  }
}

/** Indie event di prova (pubblicato, a pagamento); `overrides` cambia i campi che interessano al test. */
export function makeIndieEvent(overrides: Partial<IndieEventResponse> = {}): IndieEventResponse {
  return {
    id: 'e0000000-0000-0000-0000-000000000001',
    musician: { id: '44444444-4444-4444-4444-444444444444', displayName: 'Gazebo Penguins', avatarUrl: null },
    title: 'Underground night',
    description: 'Suoni dal basso.',
    venueName: 'Combo Social Club',
    address: 'Via del Pratellino 10, Firenze',
    latitude: 43.7801,
    longitude: 11.2388,
    eventDate: '2026-11-21T21:00:00Z',
    genreTags: ['emo'],
    coverImageUrl: null,
    isFree: false,
    status: 'PUBLISHED',
    createdAt: '2026-10-02T10:00:00Z',
    distanceKm: 5.8,
    ...overrides,
  }
}

/** Pagina di risposta di prova con questi elementi; `page` e `totalPages` simulano una lista a più pagine. */
export function makePage<T>(
  content: T[],
  { page = 0, totalPages = 1, totalElements = content.length }: { page?: number; totalPages?: number; totalElements?: number } = {},
): PageResponse<T> {
  return { content, page, size: 20, totalElements, totalPages }
}

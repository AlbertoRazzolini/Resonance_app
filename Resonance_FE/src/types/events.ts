// Tipi degli eventi, dal codice dei DTO del backend (progettazione, sezione 6.6).
import type { AuthorSummary } from './common'

/** Stato di un indie event: la bozza la vede solo il proprietario. */
export type IndieEventStatus = 'DRAFT' | 'PUBLISHED'

/** Campi comuni a concerti ufficiali e indie event; le date sono stringhe ISO-8601 in UTC. */
type EventBase = {
  id: string
  title: string
  description: string | null
  venueName: string
  address: string
  latitude: number
  longitude: number
  eventDate: string
  genreTags: string[]
  coverImageUrl: string | null
  createdAt: string
  /** Solo nelle ricerche nelle vicinanze (km dal centro cercato); `null` altrove. */
  distanceKm: number | null
}

/** Concerto ufficiale, pubblicato da un HOST. */
export type OfficialConcertResponse = EventBase & {
  host: AuthorSummary
  externalTicketUrl: string | null
}

/** Indie event, pubblicato da un MUSICIAN. */
export type IndieEventResponse = EventBase & {
  musician: AuthorSummary
  isFree: boolean
  status: IndieEventStatus
}

/** Parametri delle ricerche nelle vicinanze (progettazione, sezione 10.2); la dimensione della pagina è quella del backend. */
export type NearbyParams = {
  lat: number
  lng: number
  radiusKm: number
  page: number
}

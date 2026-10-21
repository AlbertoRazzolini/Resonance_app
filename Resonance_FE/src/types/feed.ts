// Tipi del feed, dal codice dei DTO del backend (progettazione, sezione 6.8).
import type { AuthorSummary } from './common'

/** Post del feed; `createdAt` è un istante ISO-8601 in UTC. */
export type FeedPostResponse = {
  id: string
  author: AuthorSummary
  body: string
  imageUrl: string | null
  latitude: number | null
  longitude: number | null
  likesCount: number
  likedByMe: boolean
  createdAt: string
  /** Solo nel feed filtrato per raggio (km dal centro); `null` senza filtro, nel dettaglio e in `/mine` (decisione 77). */
  distanceKm: number | null
}

/** Corpo di `POST /api/feed-posts`: testo 1–2000, immagine e coordinate facoltative (le coordinate vanno insieme). */
export type CreateFeedPostRequest = {
  body: string
  imageUrl?: string
  latitude?: number
  longitude?: number
}

/** Risposta di `PUT` e `DELETE /api/feed-posts/{id}/like`: lo stato vero dopo l'operazione. */
export type LikeStatusResponse = {
  likesCount: number
  likedByMe: boolean
}

/**
 * Parametri del feed (progettazione, sezione 6.8): il filtro geografico vuole tutti e tre i parametri o nessuno, quindi
 * senza filtro `lat`, `lng` e `radiusKm` mancano insieme. La dimensione della pagina è quella del backend.
 */
export type FeedParams = {
  lat?: number
  lng?: number
  radiusKm?: number
  page: number
}

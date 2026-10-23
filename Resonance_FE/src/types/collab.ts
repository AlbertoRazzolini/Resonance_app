// Tipi della bacheca collab, dal codice dei DTO del backend (progettazione, sezione 6.7).
import type { AuthorSummary } from './common'

/** Annuncio di collaborazione; `createdAt` è un istante ISO-8601 in UTC. */
export type CollabPostResponse = {
  id: string
  musician: AuthorSummary
  title: string
  description: string
  /** Ruolo che l'autore cerca (es. «Bassista»). */
  roleNeeded: string
  genreTags: string[]
  /** Testo libero, non geocodificato (decisione 60). */
  location: string | null
  isOpen: boolean
  createdAt: string
  /**
   * Conversazione della candidatura del chiamante: solo nel dettaglio (decisione 100), `null` per anonimi, autore e chi
   * non si è candidato, e in ogni altra risposta (elenco, `/mine`, creazione, chiusura), dove non è calcolata.
   */
  applicationConversationId: string | null
}

/** Corpo di `POST /api/collab-posts` (solo MUSICIAN): generi e luogo facoltativi, i vuoti non si inviano. */
export type CreateCollabPostRequest = {
  title: string
  description: string
  roleNeeded: string
  genreTags: string[]
  location?: string
}

/** Argomenti di una candidatura: l'annuncio e il messaggio (1–1800 caratteri). */
export type ApplyArgs = {
  id: string
  message: string
}

/** Esito di `POST /api/collab-posts/{id}/applications` (201): la conversazione con l'autore e il messaggio salvato. */
export type ApplicationResponse = {
  conversationId: string
  messageId: string
}

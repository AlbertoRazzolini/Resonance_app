// Tipi di amicizie e ricerca utenti, dal codice dei DTO del backend (progettazione, sezioni 6.5 e 6.14).
import type { AuthorSummary } from './common'

/** Stato dell'amicizia visto da chi guarda (sezione 6.14): `UNAVAILABLE` = l'altra persona ha rimosso l'amicizia o non è più disponibile. */
export type FriendshipView = 'NONE' | 'OUTGOING' | 'INCOMING' | 'FRIENDS' | 'UNAVAILABLE'

/** Elenco richiesto a `GET /api/friendships?type=`: amici, richieste ricevute o inviate. */
export type FriendshipListType = 'FRIENDS' | 'INCOMING' | 'OUTGOING'

/** Amicizia come la restituisce il backend negli elenchi e nelle risposte di richiesta e accettazione. */
export type FriendshipResponse = {
  id: string
  otherUser: AuthorSummary
  status: FriendshipView
  updatedAt: string
}

/** Stato dell'amicizia nel risultato di ricerca; `friendshipId` c'è solo per `OUTGOING`, `INCOMING` e `FRIENDS`. */
export type FriendshipSummary = {
  status: FriendshipView
  friendshipId: string | null
}

/** Un risultato di `GET /api/users/search`: mai email, coordinate o ruoli (sezione 6.5). */
export type UserSearchResult = {
  id: string
  displayName: string
  avatarUrl: string | null
  city: string | null
  friendship: FriendshipSummary
}

/** Argomenti di una pagina dell'elenco delle amicizie. */
export type FriendshipListArgs = { type: FriendshipListType; page: number; size?: number }

/** Argomenti di una pagina della ricerca: il testo è già pulito dagli spazi ai bordi. */
export type UserSearchArgs = { q: string; page: number }

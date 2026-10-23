import type { AuthorSummary } from './common'

// Tipi delle notifiche salvate, dai DTO del backend (progettazione, sezione 6.15).

/** Tipi che il backend salva (decisione 97): `NEW_MESSAGE` resta solo live, i messaggi hanno il badge della chat. */
export type SavedNotificationType = 'FRIEND_REQUEST' | 'FRIEND_ACCEPTED' | 'NEW_LIKE' | 'COLLAB_APPLICATION'

/** Notifica salvata: `targetId` è l'amicizia, il post o l'annuncio secondo il tipo; nessuna anteprima. */
export type NotificationResponse = {
  id: string
  type: SavedNotificationType
  actor: AuthorSummary
  targetId: string
  createdAt: string
  read: boolean
}

/** Risposta di `GET /api/notifications/unread-count`. */
export type UnreadCountResponse = {
  count: number
}

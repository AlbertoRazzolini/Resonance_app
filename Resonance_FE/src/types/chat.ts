import type { AuthorSummary } from './common'
import type { SavedNotificationType } from './notifications'

// Tipi della chat e delle notifiche live, dai DTO del backend (progettazione, sezioni 6.9 e 7.4).

/** Ultimo messaggio di una conversazione, in forma ridotta. */
export type LastMessage = {
  body: string
  senderId: string
  sentAt: string
}

/** Una conversazione vista da chi la legge: `canSend` falso non toglie la lettura dello storico (sezione 6.9). */
export type ConversationResponse = {
  id: string
  otherUser: AuthorSummary
  lastMessage: LastMessage | null
  unreadCount: number
  lastMessageAt: string | null
  canSend: boolean
}

/** Un messaggio: lo stesso DTO per lo storico REST e per la consegna su `/user/queue/messages`. */
export type ChatMessageResponse = {
  id: string
  conversationId: string
  senderId: string
  body: string
  sentAt: string
  readAt: string | null
}

/** Una pagina dello storico a cursore, dal messaggio più recente; `hasMore` dice se ce ne sono di più vecchi. */
export type MessagePageResponse = {
  messages: ChatMessageResponse[]
  hasMore: boolean
}

/** Argomenti dello storico: senza `before` la pagina più recente, con `before` quella prima del messaggio indicato. */
export type MessagesArgs = {
  conversationId: string
  before?: string
}

/** Tipi di notifica live (sezione 7.4): quelli salvati più `NEW_MESSAGE`; il significato di `targetId` dipende dal tipo. */
export type NotificationType = SavedNotificationType | 'NEW_MESSAGE'

/** Payload di `/user/queue/notifications`: `id` è quello della notifica salvata (nullo per `NEW_MESSAGE`), `preview` c'è solo per `NEW_MESSAGE`. */
export type LiveNotification = {
  id: string | null
  type: NotificationType
  createdAt: string
  actor: AuthorSummary
  targetId: string
  preview: string | null
}

/** Payload di `/user/queue/errors`. */
export type WsError = {
  code: string
  message: string
}

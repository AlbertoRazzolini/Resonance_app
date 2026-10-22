/** Le tre code utente a cui il client si iscrive a ogni connessione (progettazione, sezioni 7.3 e 7.4). */
export const QUEUES = {
  messages: '/user/queue/messages',
  notifications: '/user/queue/notifications',
  errors: '/user/queue/errors',
} as const

/** Nome di una delle tre code. */
export type Queue = (typeof QUEUES)[keyof typeof QUEUES]

/** Destinazione di invio di un messaggio: l'unica verso `/app/**` che il frontend usa (sezione 7.5). */
export const sendDestination = (conversationId: string) =>
  `/app/chats/${encodeURIComponent(conversationId)}/send`

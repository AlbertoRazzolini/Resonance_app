import { chatPath, collabPath, friendsPath, ROUTES, userPath } from '@/app/routes'
import type { LiveNotification } from '@/types/chat'
import type { NotificationResponse } from '@/types/notifications'

/** Ciò che serve a mostrare una notifica: la stessa forma per quella salvata e per quella live (toast). */
type NotificationLike = Pick<LiveNotification | NotificationResponse, 'type' | 'actor' | 'targetId'>

/** Testo di una notifica, uguale nel toast e nella campanella (progettazione, sezione 7.4). */
export function notificationText({ type, actor }: Pick<NotificationLike, 'type' | 'actor'>): string {
  switch (type) {
    case 'FRIEND_REQUEST':
      return `${actor.displayName} ti ha inviato una richiesta di amicizia`
    case 'FRIEND_ACCEPTED':
      return `${actor.displayName} ha accettato la tua richiesta di amicizia`
    case 'NEW_LIKE':
      return `${actor.displayName} ha messo mi piace al tuo post`
    case 'COLLAB_APPLICATION':
      return `${actor.displayName} si è candidato al tuo annuncio`
    case 'NEW_MESSAGE':
      return `Nuovo messaggio da ${actor.displayName}`
  }
}

/**
 * Dove porta un clic sulla notifica: le richieste ricevute, il profilo di chi ha accettato (`targetId` è l'amicizia, che
 * non ha una pagina), la conversazione, l'annuncio o, per un like, il feed (non esiste una pagina del singolo post:
 * `targetId` è il post ma l'app lo mostra solo nell'elenco).
 */
export function notificationPath({ type, targetId, actor }: NotificationLike): string {
  switch (type) {
    case 'FRIEND_REQUEST':
      return friendsPath('ricevute')
    case 'FRIEND_ACCEPTED':
      return userPath(actor.id)
    case 'NEW_LIKE':
      return ROUTES.feed
    case 'COLLAB_APPLICATION':
      return collabPath(targetId)
    case 'NEW_MESSAGE':
      return chatPath(targetId)
  }
}

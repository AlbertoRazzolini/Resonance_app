import { chatPath, collabPath, ROUTES } from '@/app/routes'
import type { LiveNotification } from '@/types/chat'

/** Testo di una notifica live, uguale nel toast e nella campanella (progettazione, sezione 7.4). */
export function notificationText({ type, actor }: LiveNotification): string {
  switch (type) {
    case 'NEW_LIKE':
      return `${actor.displayName} ha messo mi piace al tuo post`
    case 'COLLAB_APPLICATION':
      return `${actor.displayName} si è candidato al tuo annuncio`
    case 'NEW_MESSAGE':
      return `Nuovo messaggio da ${actor.displayName}`
  }
}

/**
 * Dove porta un clic sulla notifica: la conversazione, l'annuncio o, per un like, il feed (non esiste una pagina del
 * singolo post: `targetId` è il post ma l'app lo mostra solo nell'elenco).
 */
export function notificationPath({ type, targetId }: LiveNotification): string {
  switch (type) {
    case 'NEW_LIKE':
      return ROUTES.feed
    case 'COLLAB_APPLICATION':
      return collabPath(targetId)
    case 'NEW_MESSAGE':
      return chatPath(targetId)
  }
}

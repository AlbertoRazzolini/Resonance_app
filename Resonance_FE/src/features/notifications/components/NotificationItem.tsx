import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { formatChatListTime } from '@/lib/format/dates'
import type { NotificationResponse } from '@/types/notifications'
import { useMarkNotificationReadMutation } from '../api/notificationsApi'
import { notificationPath, notificationText } from '../notificationInfo'

type NotificationItemProps = {
  notification: NotificationResponse
  /** Pulsanti sotto il testo (Accetta e Rifiuta di una richiesta in attesa): stanno sopra il collegamento steso sulla riga. */
  actions?: ReactNode
}

/**
 * Una notifica salvata nella campanella: foto, testo (il collegamento al bersaglio, steso su tutta la riga) e ora. Il
 * clic la segna letta sul server, se non lo è già, e porta al bersaglio. «Non letta» si vede con l'accento giallo e il
 * pallino, e lo dice ai lettori di schermo.
 */
export function NotificationItem({ notification, actions }: NotificationItemProps) {
  const [markRead] = useMarkNotificationReadMutation()

  return (
    <li className={notification.read ? 'rs-notification' : 'rs-notification rs-notification--unread'}>
      <Avatar displayName={notification.actor.displayName} avatarUrl={notification.actor.avatarUrl} />
      <div className="rs-notification__body">
        <Link
          className="rs-notification__text stretched-link"
          to={notificationPath(notification)}
          onClick={() => {
            if (!notification.read) void markRead(notification.id)
          }}
        >
          {notificationText(notification)}
        </Link>
        {!notification.read && <span className="visually-hidden">Non letta</span>}
        <time className="rs-notification__time" dateTime={notification.createdAt}>
          {formatChatListTime(notification.createdAt)}
        </time>
        {actions && <div className="rs-notification__actions">{actions}</div>}
      </div>
      {!notification.read && <span className="rs-notification__dot" aria-hidden="true" />}
    </li>
  )
}

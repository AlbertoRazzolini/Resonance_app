import { Link } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { UserText } from '@/components/ui/UserText'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { formatChatListTime } from '@/lib/format/dates'
import { notificationPath, notificationText } from '../notificationInfo'
import { markRead, selectNotifications, type SessionNotification } from '../notificationsSlice'

/**
 * Una notifica della sessione nella campanella: foto, testo (il collegamento al bersaglio, steso su tutta la riga),
 * anteprima da `UserText` per i messaggi e ora. Il clic la segna letta; «non letta» si vede con l'accento e lo dice
 * ai lettori di schermo. Lo stato letto lo legge dallo store, così cambia subito dopo il clic o «Segna come lette».
 */
export function NotificationItem({ notification }: { notification: SessionNotification }) {
  const dispatch = useAppDispatch()
  const current = useAppSelector((state) => selectNotifications(state).find((item) => item.id === notification.id))
  const read = (current ?? notification).read

  return (
    <li className={read ? 'rs-notification' : 'rs-notification rs-notification--unread'}>
      <Avatar displayName={notification.actor.displayName} avatarUrl={notification.actor.avatarUrl} />
      <div className="rs-notification__body">
        <Link
          className="rs-notification__text stretched-link"
          to={notificationPath(notification)}
          onClick={() => dispatch(markRead(notification.id))}
        >
          {notificationText(notification)}
        </Link>
        {!read && <span className="visually-hidden">Non letta</span>}
        {notification.preview && (
          <div className="rs-notification__preview">
            <UserText text={notification.preview} />
          </div>
        )}
        <time className="rs-notification__time" dateTime={notification.createdAt}>
          {formatChatListTime(notification.createdAt)}
        </time>
      </div>
    </li>
  )
}

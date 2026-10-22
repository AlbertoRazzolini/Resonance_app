import { useState } from 'react'
import { Button, Dropdown } from 'react-bootstrap'
import { Link } from 'react-router'
import { friendsPath } from '@/app/routes'
import { Bell } from '@/components/animate-ui/icons/bell'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import { FriendshipButton } from '@/features/friends/components/FriendshipButton'
import { PersonRow } from '@/features/friends/components/PersonRow'
import { BELL_PAGE_SIZE, useGetPendingRequestsQuery } from '@/features/friends/api/friendsApi'
import { NotificationItem } from '@/features/notifications/components/NotificationItem'
import {
  markAllRead,
  selectNotifications,
  selectUnreadNotificationCount,
  type SessionNotification,
} from '@/features/notifications/notificationsSlice'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { FriendshipResponse } from '@/types/friends'

/** Righe del pannello: 5 sotto i 768 px e tutte le 10 chieste da tablet in su (scelta dello studente, FE-09a). */
const ROWS_PHONE = 5
/** Sopra questo numero il badge scrive «9+». */
const BADGE_MAX = 9

/** Una riga del pannello: una richiesta di amicizia o una notifica della sessione, con la data per ordinarle insieme. */
type Row =
  | { kind: 'request'; date: string; friendship: FriendshipResponse }
  | { kind: 'notification'; date: string; notification: SessionNotification }

/**
 * Campanella delle notifiche (decisione 78): una lista sola, dalla più recente, con le richieste di amicizia (Accetta e
 * Rifiuta) e le notifiche live della sessione (like, candidature, nuovi messaggi). Il numero sopra l'icona, da 1 a «9+»,
 * somma le richieste in attesa e le notifiche non lette; «Segna come lette» tocca solo le notifiche, le richieste restano
 * finché non si gestiscono. Le richieste vengono da una sola chiamata che dà numero e righe e si ricarica ad apertura
 * dell'app, all'apertura del pannello, al ritorno sulla scheda e dopo ogni azione sulle amicizie; mai a intervalli: le
 * notifiche live delle amicizie sono fuori dall'MVP (decisione 59, Post-V1) e un aggiornamento periodico le imiterebbe.
 */
export function NotificationBell() {
  const dispatch = useAppDispatch()
  const { data, error, isLoading, refetch } = useGetPendingRequestsQuery(undefined, {
    refetchOnFocus: true,
    refetchOnMountOrArgChange: true,
  })
  const notifications = useAppSelector(selectNotifications)
  const unread = useAppSelector(selectUnreadNotificationCount)
  const [show, setShow] = useState(false)
  const isTabletUp = useMediaQuery('(min-width: 768px)')
  const limit = isTabletUp ? BELL_PAGE_SIZE : ROWS_PHONE

  const requestsTotal = data?.totalElements ?? 0
  const count = requestsTotal + unread
  // Ordine stabile: a parità di data restano come arrivano (le richieste dal backend, le notifiche dalla più recente)
  const rows: Row[] = [
    ...(data?.content ?? []).map((friendship): Row => ({ kind: 'request', date: friendship.updatedAt, friendship })),
    ...notifications.map((notification): Row => ({ kind: 'notification', date: notification.createdAt, notification })),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  const shown = rows.slice(0, limit)
  const shownRequests = shown.filter((row) => row.kind === 'request').length

  const parts = [
    requestsTotal > 0 && `${requestsTotal} richieste di amicizia in attesa`,
    unread > 0 && `${unread} notifiche non lette`,
  ].filter(Boolean)
  const label = parts.length > 0 ? `Notifiche: ${parts.join(' e ')}` : 'Notifiche'

  return (
    <Dropdown
      align="end"
      show={show}
      onToggle={(next) => {
        setShow(next)
        if (next) void refetch()
      }}
    >
      <Dropdown.Toggle as="button" type="button" className="rs-bell" aria-label={label}>
        <Bell size={22} />
        {count > 0 && (
          <span className="rs-bell__count" data-testid="bell-count" aria-hidden="true">
            {count > BADGE_MAX ? `${BADGE_MAX}+` : count}
          </span>
        )}
      </Dropdown.Toggle>

      <Dropdown.Menu
        className="rs-bell__panel"
        // Un collegamento (profilo, notifica, «Vedi tutte») cambia pagina: il pannello si chiude
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a')) setShow(false)
        }}
      >
        <section aria-label="Notifiche">
          <div className="rs-bell__head">
            <h2 className="rs-bell__title">Notifiche</h2>
            {unread > 0 && (
              <Button variant="link" size="sm" onClick={() => dispatch(markAllRead())}>
                Segna come lette
              </Button>
            )}
          </div>

          {isLoading && (
            <Skeleton>
              {[0, 1].map((row) => (
                <div key={row} className="rs-person">
                  <SkeletonLine width={8} />
                </div>
              ))}
            </Skeleton>
          )}

          {error && <ErrorAlert error={error} />}

          {!isLoading && !error && rows.length === 0 && <p className="rs-field-hint">Nessuna notifica.</p>}

          {shown.length > 0 && (
            <ul className="rs-person-list">
              {shown.map((row) =>
                row.kind === 'request' ? (
                  <PersonRow
                    key={row.friendship.id}
                    id={row.friendship.otherUser.id}
                    displayName={row.friendship.otherUser.displayName}
                    avatarUrl={row.friendship.otherUser.avatarUrl}
                  >
                    <FriendshipButton
                      userId={row.friendship.otherUser.id}
                      displayName={row.friendship.otherUser.displayName}
                      status="INCOMING"
                      friendshipId={row.friendship.id}
                    />
                  </PersonRow>
                ) : (
                  <NotificationItem key={row.notification.id} notification={row.notification} />
                ),
              )}
            </ul>
          )}

          {requestsTotal > shownRequests && (
            <Link className="rs-bell__all" to={friendsPath('ricevute')}>
              Vedi tutte
            </Link>
          )}
        </section>
      </Dropdown.Menu>
    </Dropdown>
  )
}

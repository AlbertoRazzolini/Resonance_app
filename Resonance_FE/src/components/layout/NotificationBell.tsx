import { AnimateIcon } from '@animate-ui/react/icons'
import { useMemo, useState } from 'react'
import { Button, Dropdown } from 'react-bootstrap'
import { Bell } from '@/components/animate-ui/icons/bell'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useGetPendingRequestsQuery } from '@/features/friends/api/friendsApi'
import {
  useGetUnreadCountQuery,
  useMarkAllNotificationsReadMutation,
} from '@/features/notifications/api/notificationsApi'
import { NotificationPages } from '@/features/notifications/components/NotificationPages'

/** Sopra questo numero il badge scrive «9+». */
const BADGE_MAX = 9

/**
 * Campanella delle notifiche (decisioni 78 e 97): un elenco unico, dalla più recente, delle notifiche salvate dal backend
 * (richieste e accettazioni di amicizia, mi piace, candidature), che restano finché non sono lette anche dopo il ricarico.
 * Il numero sull'icona, da 1 a «9+», sono le non lette del server e scende solo segnandole lette; si rilegge ad apertura
 * dell'app, all'apertura del pannello, al ritorno sulla scheda e dopo una riconnessione, mai a intervalli. Le notifiche
 * live entrano nella cache senza chiamare il server. Una richiesta di amicizia ancora in attesa ha Accetta e Rifiuta nella
 * sua riga. L'icona oscilla al passaggio del mouse e al tocco, come le altre della navigazione (decisione 83).
 */
export function NotificationBell() {
  const [show, setShow] = useState(false)
  const { data: unread = 0, refetch } = useGetUnreadCountQuery(undefined, {
    refetchOnFocus: true,
    refetchOnMountOrArgChange: true,
  })
  // Le richieste in attesa servono solo a mostrare Accetta e Rifiuta: si chiedono ad ogni apertura del pannello
  const { data: pending } = useGetPendingRequestsQuery(undefined, { skip: !show, refetchOnMountOrArgChange: true })
  const pendingRequests = useMemo(
    () => new Map((pending?.content ?? []).map((friendship) => [friendship.id, friendship])),
    [pending],
  )
  const [markAllRead, { error: markAllError }] = useMarkAllNotificationsReadMutation()

  const label = unread > 0 ? `Notifiche: ${unread} ${unread === 1 ? 'non letta' : 'non lette'}` : 'Notifiche'

  return (
    <Dropdown
      align="end"
      show={show}
      onToggle={(next) => {
        setShow(next)
        if (next) void refetch()
      }}
    >
      {/* Come le altre icone della navigazione: l'animazione sta sul pulsante intero, così parte anche con il mouse sul numero */}
      <AnimateIcon animateOnHover animateOnTap asChild>
        <Dropdown.Toggle as="button" type="button" className="rs-bell" aria-label={label}>
          <Bell size={22} />
          {unread > 0 && (
            <span className="rs-bell__count" data-testid="bell-count" aria-hidden="true">
              {unread > BADGE_MAX ? `${BADGE_MAX}+` : unread}
            </span>
          )}
        </Dropdown.Toggle>
      </AnimateIcon>

      <Dropdown.Menu
        className="rs-bell__panel"
        // Un collegamento (profilo, notifica) cambia pagina: il pannello si chiude
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a')) setShow(false)
        }}
      >
        <section aria-label="Notifiche">
          <div className="rs-bell__head">
            <h2 className="rs-bell__title">Notifiche</h2>
            {unread > 0 && (
              <Button variant="link" size="sm" onClick={() => void markAllRead()}>
                Segna come lette
              </Button>
            )}
          </div>

          {markAllError && <ErrorAlert error={markAllError} />}

          {show && <NotificationPages pendingRequests={pendingRequests} />}
        </section>
      </Dropdown.Menu>
    </Dropdown>
  )
}

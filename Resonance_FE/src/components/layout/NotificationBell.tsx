import { useState } from 'react'
import { Dropdown } from 'react-bootstrap'
import { Link } from 'react-router'
import { friendsPath } from '@/app/routes'
import { Bell } from '@/components/animate-ui/icons/bell'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import { FriendshipButton } from '@/features/friends/components/FriendshipButton'
import { PersonRow } from '@/features/friends/components/PersonRow'
import { BELL_PAGE_SIZE, useGetPendingRequestsQuery } from '@/features/friends/api/friendsApi'
import { useMediaQuery } from '@/hooks/useMediaQuery'

/** Righe del pannello: 5 sotto i 768 px e tutte le 10 chieste da tablet in su (scelta dello studente, FE-09a). */
const ROWS_PHONE = 5
/** Sopra questo numero il badge scrive «9+». */
const BADGE_MAX = 9

/**
 * Campanella delle notifiche (decisione 78): il numero sopra l'icona sono le richieste di amicizia in attesa, da 1 a «9+»,
 * e il clic apre un pannello con una riga per richiesta (Accetta e Rifiuta). Una sola chiamata dà numero e righe. Si
 * ricarica ad apertura dell'app, all'apertura del pannello, al ritorno sulla scheda del browser e dopo ogni azione sulle
 * amicizie; mai a intervalli: le notifiche live delle amicizie sono fuori dall'MVP (decisione 59, Post-V1) e un
 * aggiornamento periodico le imiterebbe. FE-09b aggiunge qui le notifiche live della sessione come altre righe.
 */
export function NotificationBell() {
  const { data, error, isLoading, refetch } = useGetPendingRequestsQuery(undefined, {
    refetchOnFocus: true,
    refetchOnMountOrArgChange: true,
  })
  const [show, setShow] = useState(false)
  const isTabletUp = useMediaQuery('(min-width: 768px)')
  const limit = isTabletUp ? BELL_PAGE_SIZE : ROWS_PHONE

  const total = data?.totalElements ?? 0
  const rows = data?.content.slice(0, limit) ?? []
  const label = total > 0 ? `Notifiche: ${total} richieste di amicizia in attesa` : 'Notifiche'

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
        {total > 0 && (
          <span className="rs-bell__count" data-testid="bell-count" aria-hidden="true">
            {total > BADGE_MAX ? `${BADGE_MAX}+` : total}
          </span>
        )}
      </Dropdown.Toggle>

      <Dropdown.Menu
        className="rs-bell__panel"
        // Un collegamento (profilo, «Vedi tutte») cambia pagina: il pannello si chiude
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a')) setShow(false)
        }}
      >
        <section aria-label="Notifiche">
          <h2 className="rs-bell__title">Notifiche</h2>

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

          {data && rows.length === 0 && <p className="rs-field-hint">Nessuna richiesta in attesa.</p>}

          {rows.length > 0 && (
            <ul className="rs-person-list">
              {rows.map((friendship) => (
                <PersonRow
                  key={friendship.id}
                  id={friendship.otherUser.id}
                  displayName={friendship.otherUser.displayName}
                  avatarUrl={friendship.otherUser.avatarUrl}
                >
                  <FriendshipButton
                    userId={friendship.otherUser.id}
                    displayName={friendship.otherUser.displayName}
                    status="INCOMING"
                    friendshipId={friendship.id}
                  />
                </PersonRow>
              ))}
            </ul>
          )}

          {total > rows.length && (
            <Link className="rs-bell__all" to={friendsPath('ricevute')}>
              Vedi tutte
            </Link>
          )}
        </section>
      </Dropdown.Menu>
    </Dropdown>
  )
}

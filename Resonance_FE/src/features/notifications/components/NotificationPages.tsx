import { useState } from 'react'
import { Button } from 'react-bootstrap'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadMore } from '@/components/ui/LoadMore'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import { FriendshipButton } from '@/features/friends/components/FriendshipButton'
import type { FriendshipResponse } from '@/types/friends'
import { useGetNotificationsQuery } from '../api/notificationsApi'
import { NotificationItem } from './NotificationItem'

type PagesProps = {
  /** Richieste di amicizia ancora in attesa, per id dell'amicizia (`targetId` della notifica `FRIEND_REQUEST`). */
  pendingRequests: ReadonlyMap<string, FriendshipResponse>
}

type PageProps = PagesProps & { page: number; isLast: boolean; onLoadMore: () => void }

/** Una pagina dell'elenco: ha la sua voce di cache, così un'invalidazione rilegge tutte le pagine aperte. */
function NotificationPage({ page, isLast, onLoadMore, pendingRequests }: PageProps) {
  // Ogni apertura del pannello rilegge la pagina: mostra subito quella in cache e poi la aggiorna
  const query = useGetNotificationsQuery(page, { refetchOnMountOrArgChange: true })
  const data = query.data

  return (
    <>
      {query.isLoading && (
        <Skeleton>
          {[0, 1].map((row) => (
            <div key={row} className="rs-person">
              <SkeletonLine width={8} />
            </div>
          ))}
        </Skeleton>
      )}

      {query.isSuccess && page === 0 && data?.content.length === 0 && <p className="rs-field-hint">Nessuna notifica.</p>}

      {data && data.content.length > 0 && (
        <ul className="rs-person-list">
          {data.content.map((notification) => {
            // Accetta e Rifiuta solo finché la richiesta è in attesa e tra quelle caricate (decisione 91, FE-13)
            const request = notification.type === 'FRIEND_REQUEST' ? pendingRequests.get(notification.targetId) : undefined
            return (
              <NotificationItem
                key={notification.id}
                notification={notification}
                actions={
                  request && (
                    <FriendshipButton
                      userId={request.otherUser.id}
                      displayName={request.otherUser.displayName}
                      status="INCOMING"
                      friendshipId={request.id}
                    />
                  )
                }
              />
            )
          })}
        </ul>
      )}

      {query.error && (
        <>
          <ErrorAlert error={query.error} />
          <Button variant="outline-light" size="sm" onClick={() => void query.refetch()}>
            Riprova
          </Button>
        </>
      )}

      {isLast && (
        <LoadMore
          hasMore={data !== undefined && data.page + 1 < data.totalPages}
          loading={query.isFetching}
          onClick={onLoadMore}
        />
      )}
    </>
  )
}

/** Elenco delle notifiche salvate a pagine di 10, dalla più recente, con «Carica altri» (progettazione, sezione 6.15). */
export function NotificationPages({ pendingRequests }: PagesProps) {
  const [pages, setPages] = useState(1)
  return (
    <>
      {Array.from({ length: pages }, (_, page) => (
        <NotificationPage
          key={page}
          page={page}
          isLast={page === pages - 1}
          onLoadMore={() => setPages(page + 2)}
          pendingRequests={pendingRequests}
        />
      ))}
    </>
  )
}

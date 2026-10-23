import { useState } from 'react'
import { Button } from 'react-bootstrap'
import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadMore } from '@/components/ui/LoadMore'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import type { FriendshipListType } from '@/types/friends'
import DesktopMagnet from '@/components/motion/DesktopMagnet'
import { useGetFriendshipsQuery } from '../api/friendsApi'
import { FriendshipButton } from './FriendshipButton'
import { PersonRow } from './PersonRow'

/** Testo dello stato vuoto di ogni elenco (approvati dallo studente, FE-09a). */
const EMPTY_TEXT: Record<FriendshipListType, string> = {
  FRIENDS: 'Non hai ancora amici.',
  INCOMING: 'Nessuna richiesta ricevuta.',
  OUTGOING: 'Nessuna richiesta inviata.',
}

type PageProps = { type: FriendshipListType; page: number; isLast: boolean; onLoadMore: () => void }

/** Una pagina dell'elenco: ha la sua voce di cache, così dopo un'azione si rileggono tutte quelle aperte. */
function FriendshipPage({ type, page, isLast, onLoadMore }: PageProps) {
  const query = useGetFriendshipsQuery({ type, page })
  const data = query.data

  return (
    <>
      {query.isLoading && (
        <Skeleton>
          {[0, 1, 2].map((row) => (
            <div key={row} className="rs-person">
              <SkeletonLine width={8} />
            </div>
          ))}
        </Skeleton>
      )}

      {query.isSuccess && page === 0 && data?.content.length === 0 && (
        <EmptyState title={EMPTY_TEXT[type]}>
          <DesktopMagnet>
            <Link className="btn btn-outline-light btn-sm" to={ROUTES.userSearch}>
              Cerca persone
            </Link>
          </DesktopMagnet>
        </EmptyState>
      )}

      {data && data.content.length > 0 && (
        <ul className="rs-person-list">
          {data.content.map((friendship) => (
            <PersonRow
              key={friendship.id}
              id={friendship.otherUser.id}
              displayName={friendship.otherUser.displayName}
              avatarUrl={friendship.otherUser.avatarUrl}
            >
              <FriendshipButton
                userId={friendship.otherUser.id}
                displayName={friendship.otherUser.displayName}
                status={type}
                friendshipId={friendship.id}
              />
            </PersonRow>
          ))}
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

/** Elenco a pagine con «Carica altri» di amici, richieste ricevute o inviate (progettazione, sezione 6.14). */
export function FriendshipPages({ type }: { type: FriendshipListType }) {
  const [pages, setPages] = useState(1)
  return (
    <>
      {Array.from({ length: pages }, (_, page) => (
        <FriendshipPage
          key={page}
          type={type}
          page={page}
          isLast={page === pages - 1}
          onLoadMore={() => setPages(page + 2)}
        />
      ))}
    </>
  )
}

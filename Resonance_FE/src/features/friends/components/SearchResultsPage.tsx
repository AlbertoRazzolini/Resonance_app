import { Button } from 'react-bootstrap'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadMore } from '@/components/ui/LoadMore'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import { useSearchUsersQuery } from '../api/friendsApi'
import { FriendshipButton } from './FriendshipButton'
import { PersonRow } from './PersonRow'

type SearchResultsPageProps = {
  term: string
  page: number
  /** Ultima pagina caricata: è lei a offrire «Carica altri». */
  isLast: boolean
  onLoadMore: () => void
}

/**
 * Una pagina dei risultati: ogni pagina ha la sua voce di cache (`q` e `page`), così dopo un'azione si rileggono tutte
 * quelle aperte, senza accodamenti che duplicherebbero le persone.
 */
export function SearchResultsPage({ term, page, isLast, onLoadMore }: SearchResultsPageProps) {
  const query = useSearchUsersQuery({ q: term, page })
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
        <EmptyState title="Nessuna persona trovata." />
      )}

      {data && data.content.length > 0 && (
        <ul className="rs-person-list">
          {data.content.map((result) => (
            <PersonRow
              key={result.id}
              id={result.id}
              displayName={result.displayName}
              avatarUrl={result.avatarUrl}
              city={result.city}
            >
              <FriendshipButton
                userId={result.id}
                displayName={result.displayName}
                status={result.friendship.status}
                friendshipId={result.friendship.friendshipId}
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

import { useState, type ReactNode } from 'react'
import { Button } from 'react-bootstrap'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadMore } from '@/components/ui/LoadMore'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import { useGetCollabPostsQuery } from '../api/collabApi'
import { CollabCard } from './CollabCard'

type CollabPageProps = {
  page: number
  /** Ultima pagina caricata: è lei a offrire «Carica altri». */
  isLast: boolean
  emptyState: ReactNode
  onLoadMore: () => void
}

/**
 * Una pagina della bacheca: ogni pagina ha la sua voce di cache (`?page=N`), così dopo una chiusura, una cancellazione
 * o una creazione si rileggono tutte quelle aperte, senza accodamenti che duplicherebbero gli annunci.
 */
function CollabPage({ page, isLast, emptyState, onLoadMore }: CollabPageProps) {
  const query = useGetCollabPostsQuery(page)
  const data = query.data

  return (
    <>
      {query.isLoading && (
        <Skeleton>
          {[0, 1].map((row) => (
            <div key={row} className="rs-collab-card">
              <SkeletonLine width={4} />
              <SkeletonLine width={9} />
              <SkeletonLine width={6} />
            </div>
          ))}
        </Skeleton>
      )}

      {query.isSuccess && page === 0 && data?.content.length === 0 && emptyState}

      {data?.content.map((post) => <CollabCard key={post.id} post={post} />)}

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

/** Elenco degli annunci aperti a pagine con «Carica altri» (progettazione, sezione 6.7). */
export function CollabPages({ emptyState }: { emptyState: ReactNode }) {
  const [pages, setPages] = useState(1)
  return (
    <div className="rs-collab-list">
      {Array.from({ length: pages }, (_, page) => (
        <CollabPage key={page} page={page} isLast={page === pages - 1} emptyState={emptyState} onLoadMore={() => setPages(page + 2)} />
      ))}
    </div>
  )
}

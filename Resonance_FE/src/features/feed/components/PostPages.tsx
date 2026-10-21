import { useState, type ReactNode } from 'react'
import { Button } from 'react-bootstrap'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadMore } from '@/components/ui/LoadMore'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import { useGetFeedQuery, useGetMyPostsQuery } from '../api/feedApi'
import { FeedPostCard } from './FeedPostCard'

/** Filtro geografico del feed: centro e raggio insieme, oppure nessun filtro (progettazione, sezione 6.8). */
export type FeedFilter = { lat: number; lng: number; radiusKm: number }

/** Quale elenco mostrare: il feed pubblico (con o senza filtro) o i miei post (scheda dell'area personale). */
export type PostSource = { kind: 'feed'; filter: FeedFilter | null } | { kind: 'mine' }

type PostPageProps = {
  source: PostSource
  page: number
  /** Ultima pagina caricata: è lei a offrire «Carica altri». */
  isLast: boolean
  emptyState: ReactNode
  onLoadMore: () => void
  onDeleted: () => void
}

/**
 * Una pagina dell'elenco: ogni pagina ha la sua voce di cache (`?page=N`), così dopo una creazione, una cancellazione o
 * un like si rileggono o si aggiornano tutte quelle aperte, senza accodamenti che duplicherebbero i post.
 */
function PostPage({ source, page, isLast, emptyState, onLoadMore, onDeleted }: PostPageProps) {
  // Una sola delle due ricerche è attiva: l'altra resta spenta con `skip`
  const feed = useGetFeedQuery({ ...(source.kind === 'feed' ? source.filter : null), page }, { skip: source.kind !== 'feed' })
  const mine = useGetMyPostsQuery(page, { skip: source.kind !== 'mine' })
  const query = source.kind === 'feed' ? feed : mine
  const data = query.data

  return (
    <>
      {query.isLoading && (
        <Skeleton>
          {[0, 1].map((row) => (
            <div key={row} className="rs-post">
              <SkeletonLine width={4} />
              <SkeletonLine width={9} />
              <SkeletonLine width={6} />
            </div>
          ))}
        </Skeleton>
      )}

      {query.isSuccess && page === 0 && data?.content.length === 0 && emptyState}

      {data?.content.map((post) => (
        <FeedPostCard key={post.id} post={post} onDeleted={onDeleted} />
      ))}

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

type PostPagesProps = Omit<PostPageProps, 'page' | 'isLast' | 'onLoadMore'>

/**
 * Elenco di post a pagine con «Carica altri», uguale per il feed e per la scheda «Post». Chi lo usa lo rimonta con una
 * `key` quando cambia la ricerca (filtro, raggio), così si riparte dalla prima pagina.
 */
export function PostPages(props: PostPagesProps) {
  const [pages, setPages] = useState(1)
  return (
    <div className="rs-posts">
      {Array.from({ length: pages }, (_, page) => (
        <PostPage key={page} {...props} page={page} isLast={page === pages - 1} onLoadMore={() => setPages(page + 2)} />
      ))}
    </div>
  )
}

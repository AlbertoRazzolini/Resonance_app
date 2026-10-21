import { Button } from 'react-bootstrap'
import { useParams } from 'react-router'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import { isCollabNotFound, useGetCollabPostQuery } from '../api/collabApi'
import { CollabDetail } from '../components/CollabDetail'
import { CollabNotFound } from '../components/CollabNotFound'

/**
 * Dettaglio di un annuncio collab, aperto anche a chi non ha la sessione e anche se l'annuncio è chiuso (progettazione,
 * sezione 6.7). Un annuncio nascosto o inesistente dà 404 e qui diventa «Annuncio non trovato» (Review Focus 6).
 */
export function Component() {
  const { id } = useParams()
  const { data, error, isLoading, refetch } = useGetCollabPostQuery(id ?? '', { skip: !id })

  if (isLoading) {
    return (
      <Skeleton>
        <SkeletonLine width={4} />
        <SkeletonLine width={8} />
        <SkeletonLine width={6} />
      </Skeleton>
    )
  }
  if (isCollabNotFound(error)) return <CollabNotFound />
  if (error || !data) {
    return (
      <>
        <ErrorAlert error={error ?? new Error('annuncio assente')} />
        <Button variant="outline-light" size="sm" onClick={() => void refetch()}>
          Riprova
        </Button>
      </>
    )
  }
  return <CollabDetail post={data} />
}

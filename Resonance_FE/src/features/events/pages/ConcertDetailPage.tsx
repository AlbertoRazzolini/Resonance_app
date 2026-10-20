import { Button } from 'react-bootstrap'
import { useParams } from 'react-router'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import { isEventNotFound, useGetConcertQuery } from '../api/eventsApi'
import { EventDetail } from '../components/EventDetail'
import { EventNotFound } from '../components/EventNotFound'

/**
 * Dettaglio di un concerto ufficiale, aperto anche a chi non ha la sessione (progettazione, sezione 6.6). Un concerto
 * nascosto o inesistente è un 404 e diventa «Evento non trovato» (Review Focus 6); gli altri errori si mostrano con il
 * loro messaggio e «Riprova».
 */
export function Component() {
  const { id } = useParams()
  const { data, error, isLoading, refetch } = useGetConcertQuery(id ?? '', { skip: !id })

  if (isLoading) {
    return (
      <Skeleton>
        <SkeletonLine width={4} />
        <SkeletonLine width={8} />
        <SkeletonLine width={6} />
      </Skeleton>
    )
  }
  if (isEventNotFound(error)) return <EventNotFound />
  if (error || !data) {
    return (
      <>
        <ErrorAlert error={error ?? new Error('concerto assente')} />
        <Button variant="outline-light" size="sm" onClick={() => void refetch()}>
          Riprova
        </Button>
      </>
    )
  }
  return <EventDetail kind="official" event={data} />
}

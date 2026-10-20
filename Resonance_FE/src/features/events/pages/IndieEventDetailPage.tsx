import { Button } from 'react-bootstrap'
import { useParams } from 'react-router'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import { isEventNotFound, useGetIndieEventQuery } from '../api/eventsApi'
import { EventDetail } from '../components/EventDetail'
import { EventNotFound } from '../components/EventNotFound'

/**
 * Dettaglio di un indie event, aperto anche a chi non ha la sessione (progettazione, sezione 6.6). Una bozza è visibile
 * solo al proprietario: per chiunque altro, come per un evento nascosto o inesistente, il backend risponde 404 e qui
 * diventa «Evento non trovato» (Review Focus 6).
 */
export function Component() {
  const { id } = useParams()
  const { data, error, isLoading, refetch } = useGetIndieEventQuery(id ?? '', { skip: !id })

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
        <ErrorAlert error={error ?? new Error('indie event assente')} />
        <Button variant="outline-light" size="sm" onClick={() => void refetch()}>
          Riprova
        </Button>
      </>
    )
  }
  return <EventDetail kind="indie" event={data} />
}

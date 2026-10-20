import { useState } from 'react'
import { Alert, Button } from 'react-bootstrap'
import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'
import type { EventKind } from '@/components/map'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadMore } from '@/components/ui/LoadMore'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import type { IndieEventResponse } from '@/types/events'
import {
  useDeleteConcertMutation,
  useDeleteIndieEventMutation,
  useGetMyConcertsQuery,
  useGetMyIndieEventsQuery,
  usePublishIndieEventMutation,
} from '../api/eventsApi'
import { MyEventRow, type MyEvent } from './MyEventRow'

type MyEventsPageProps = {
  kind: EventKind
  page: number
  /** Ultima pagina caricata: è lei a offrire «Carica altri». */
  isLast: boolean
  now: number
  busy: boolean
  onLoadMore: () => void
  onPublish: (event: IndieEventResponse) => void
  onDelete: (item: MyEvent) => void
}

/**
 * Una pagina dell'elenco: ogni pagina ha la sua voce nella cache (`/mine?page=N`), così dopo una pubblicazione o una
 * cancellazione si rileggono tutte quelle aperte, senza accodamenti che duplicherebbero righe.
 */
function MyEventsPage({ kind, page, isLast, now, busy, onLoadMore, onPublish, onDelete }: MyEventsPageProps) {
  // Una sola delle due ricerche è attiva: l'altra resta spenta con `skip`
  const concerts = useGetMyConcertsQuery(page, { skip: kind !== 'official' })
  const indie = useGetMyIndieEventsQuery(page, { skip: kind !== 'indie' })
  const query = kind === 'official' ? concerts : indie
  const items: MyEvent[] =
    kind === 'official'
      ? (concerts.data?.content ?? []).map((event) => ({ kind: 'official', event }))
      : (indie.data?.content ?? []).map((event) => ({ kind: 'indie', event }))
  const data = query.data

  return (
    <>
      {query.isLoading && (
        <Skeleton>
          {[0, 1].map((row) => (
            <div key={row} className="rs-my-event">
              <div className="rs-my-event__main">
                <SkeletonLine width={4} />
                <SkeletonLine width={8} />
              </div>
            </div>
          ))}
        </Skeleton>
      )}

      {query.isSuccess && page === 0 && items.length === 0 && (
        <EmptyState title="Non sono ancora presenti eventi pubblicati.">
          <Link className="btn btn-primary" to={kind === 'official' ? ROUTES.newConcert : ROUTES.newIndieEvent}>
            Pubblica evento
          </Link>
        </EmptyState>
      )}

      {items.map((item) => (
        <MyEventRow key={item.event.id} item={item} now={now} busy={busy} onPublish={onPublish} onDelete={onDelete} />
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

/**
 * Scheda «Concerti» o «Indie event» dell'area personale (decisione 77, progettazione sezione 6.6): i propri eventi,
 * «Pubblica» per le bozze e «Cancella» con conferma e motivo facoltativo. Dopo ogni azione l'elenco si rilegge (tag
 * `MINE`) e un avviso dice com'è andata; un errore mostra il messaggio del suo codice.
 */
export function MyEventsTab({ kind }: { kind: EventKind }) {
  const [pages, setPages] = useState(1)
  const [now] = useState(() => Date.now())
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<unknown>(null)
  const [toDelete, setToDelete] = useState<MyEvent | null>(null)
  const [publishIndieEvent, publishing] = usePublishIndieEventMutation()
  const [deleteConcert, deletingConcert] = useDeleteConcertMutation()
  const [deleteIndieEvent, deletingIndie] = useDeleteIndieEventMutation()
  const busy = publishing.isLoading || deletingConcert.isLoading || deletingIndie.isLoading

  async function handlePublish(event: IndieEventResponse) {
    setNotice(null)
    setActionError(null)
    try {
      await publishIndieEvent(event.id).unwrap()
      setNotice('Evento pubblicato.')
    } catch (error) {
      setActionError(error)
    }
  }

  async function handleDelete(reason?: string) {
    if (!toDelete) return
    setNotice(null)
    setActionError(null)
    try {
      const args = { id: toDelete.event.id, reason }
      await (toDelete.kind === 'official' ? deleteConcert(args) : deleteIndieEvent(args)).unwrap()
      setNotice('Evento cancellato.')
    } catch (error) {
      setActionError(error)
    }
    setToDelete(null)
  }

  return (
    <div className="rs-my-events">
      {notice && (
        <Alert variant="success" role="status">
          {notice}
        </Alert>
      )}
      <ErrorAlert error={actionError} />
      {Array.from({ length: pages }, (_, page) => (
        <MyEventsPage
          key={page}
          kind={kind}
          page={page}
          isLast={page === pages - 1}
          now={now}
          busy={busy}
          onLoadMore={() => setPages(page + 2)}
          onPublish={(event) => void handlePublish(event)}
          onDelete={setToDelete}
        />
      ))}
      <ConfirmDialog
        show={toDelete !== null}
        title="Cancellare l'evento?"
        body="L'evento non sarà più visibile a nessuno. L'operazione non si può annullare."
        confirmLabel="Cancella evento"
        withReason
        busy={busy}
        onConfirm={(reason) => void handleDelete(reason)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}

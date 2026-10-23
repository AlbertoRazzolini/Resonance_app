import { useState } from 'react'
import { Alert, Button } from 'react-bootstrap'
import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadMore } from '@/components/ui/LoadMore'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import type { CollabPostResponse } from '@/types/collab'
import DesktopMagnet from '@/components/motion/DesktopMagnet'
import {
  useCloseCollabPostMutation,
  useDeleteCollabPostMutation,
  useGetMyCollabPostsQuery,
} from '../api/collabApi'
import { CloseCollabDialog, DeleteCollabDialog } from './CollabConfirmDialogs'
import { MyCollabRow } from './MyCollabRow'

type MyCollabPageProps = {
  page: number
  /** Ultima pagina caricata: è lei a offrire «Carica altri». */
  isLast: boolean
  busy: boolean
  onLoadMore: () => void
  onClose: (post: CollabPostResponse) => void
  onDelete: (post: CollabPostResponse) => void
}

/**
 * Una pagina dell'elenco: ogni pagina ha la sua voce nella cache (`/mine?page=N`), così dopo una chiusura o una
 * cancellazione si rileggono tutte quelle aperte, senza accodamenti che duplicherebbero righe.
 */
function MyCollabPage({ page, isLast, busy, onLoadMore, onClose, onDelete }: MyCollabPageProps) {
  const query = useGetMyCollabPostsQuery(page)
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

      {query.isSuccess && page === 0 && data?.content.length === 0 && (
        <EmptyState title="Non hai ancora pubblicato annunci.">
          <DesktopMagnet>
            <Link className="btn btn-primary" to={ROUTES.newCollab}>
              Pubblica annuncio
            </Link>
          </DesktopMagnet>
        </EmptyState>
      )}

      {data?.content.map((post) => (
        <MyCollabRow key={post.id} post={post} busy={busy} onClose={onClose} onDelete={onDelete} />
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
 * Scheda «Annunci» dell'area personale (decisione 77, progettazione sezione 6.7): i propri annunci, chiusi compresi,
 * con «Apri», «Chiudi» e «Cancella» con conferma. Dopo ogni azione l'elenco si rilegge (tag `MINE`) e un avviso dice
 * com'è andata; un errore mostra il messaggio del suo codice.
 */
export function MyCollabTab() {
  const [pages, setPages] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<unknown>(null)
  const [toClose, setToClose] = useState<CollabPostResponse | null>(null)
  const [toDelete, setToDelete] = useState<CollabPostResponse | null>(null)
  const [closeCollabPost, closing] = useCloseCollabPostMutation()
  const [deleteCollabPost, deleting] = useDeleteCollabPostMutation()
  const busy = closing.isLoading || deleting.isLoading

  async function handleClose() {
    if (!toClose) return
    setNotice(null)
    setActionError(null)
    try {
      await closeCollabPost(toClose.id).unwrap()
      setNotice('Annuncio chiuso.')
    } catch (error) {
      setActionError(error)
    }
    setToClose(null)
  }

  async function handleDelete(reason?: string) {
    if (!toDelete) return
    setNotice(null)
    setActionError(null)
    try {
      await deleteCollabPost({ id: toDelete.id, reason }).unwrap()
      setNotice('Annuncio cancellato.')
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
        <MyCollabPage
          key={page}
          page={page}
          isLast={page === pages - 1}
          busy={busy}
          onLoadMore={() => setPages(page + 2)}
          onClose={setToClose}
          onDelete={setToDelete}
        />
      ))}
      <CloseCollabDialog
        show={toClose !== null}
        busy={busy}
        onConfirm={() => void handleClose()}
        onCancel={() => setToClose(null)}
      />
      <DeleteCollabDialog
        show={toDelete !== null}
        busy={busy}
        onConfirm={(reason) => void handleDelete(reason)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}

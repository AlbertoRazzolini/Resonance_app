import { useState } from 'react'
import { Button } from 'react-bootstrap'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/app/routes'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import type { CollabPostResponse } from '@/types/collab'
import { useCloseCollabPostMutation, useDeleteCollabPostMutation } from '../api/collabApi'
import type { CollabLocationState } from '../collabForm'
import { CloseCollabDialog, DeleteCollabDialog } from './CollabConfirmDialogs'

/**
 * «Chiudi annuncio» (solo se aperto) e «Cancella» del proprietario, ciascuno con la sua conferma. A cancellazione
 * riuscita il dettaglio non esiste più: si torna al profilo con il segno per l'avviso. Chi non è il proprietario non
 * vede niente: la protezione vera è il 403 `NOT_OWNER` del backend.
 */
export function CollabOwnerActions({ post }: { post: CollabPostResponse }) {
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [closeCollabPost, closeState] = useCloseCollabPostMutation()
  const [deleteCollabPost, deleteState] = useDeleteCollabPostMutation()

  async function handleClose() {
    setError(null)
    try {
      await closeCollabPost(post.id).unwrap()
    } catch (failure) {
      setError(failure)
    }
    setClosing(false)
  }

  async function handleDelete(reason?: string) {
    setError(null)
    try {
      await deleteCollabPost({ id: post.id, reason }).unwrap()
      const state: CollabLocationState = { collabDeleted: true }
      navigate(ROUTES.profile, { state })
    } catch (failure) {
      setError(failure)
    }
    setDeleting(false)
  }

  return (
    <div className="rs-event-detail__owner">
      <ErrorAlert error={error} />
      <div className="rs-my-event__actions">
        {post.isOpen && (
          <Button variant="outline-light" size="sm" onClick={() => setClosing(true)}>
            Chiudi annuncio
          </Button>
        )}
        <Button variant="outline-light" size="sm" onClick={() => setDeleting(true)}>
          Cancella
        </Button>
      </div>
      <CloseCollabDialog
        show={closing}
        busy={closeState.isLoading}
        onConfirm={() => void handleClose()}
        onCancel={() => setClosing(false)}
      />
      <DeleteCollabDialog
        show={deleting}
        busy={deleteState.isLoading}
        onConfirm={(reason) => void handleDelete(reason)}
        onCancel={() => setDeleting(false)}
      />
    </div>
  )
}

import { useId, useState } from 'react'
import { Button, Modal } from 'react-bootstrap'
import { Link, useLocation } from 'react-router'
import { ROUTES } from '@/app/routes'
import type { LoginRedirectState } from '@/components/guards/RequireAuth'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { NewPostForm } from './NewPostForm'

type NewPostPanelProps = {
  /** Il post è stato pubblicato: gli avvisi da mostrare nella pagina. */
  onPublished: (notices: string[]) => void
}

/**
 * Dove si scrive un nuovo post (decisione dello studente, 21 ottobre): da 768 px in su il modulo sta in cima al feed, su
 * telefono sta dietro il pulsante «Nuovo post», in una finestra che si chiude a pubblicazione riuscita. Chi non ha la
 * sessione trova un invito ad accedere e, dopo l'accesso, torna al feed.
 */
export function NewPostPanel({ onPublished }: NewPostPanelProps) {
  const user = useAppSelector(selectCurrentUser)
  const wide = useMediaQuery('(min-width: 768px)')
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const { pathname, search, hash } = useLocation()

  if (!user) {
    const state: LoginRedirectState = { from: pathname + search + hash, loginRequired: true }
    return (
      <div className="rs-new-post-panel rs-new-post-panel--anonymous">
        <p>Accedi per scrivere un post.</p>
        <Link className="btn btn-primary" to={ROUTES.login} state={state}>
          Accedi
        </Link>
      </div>
    )
  }

  if (wide) {
    return (
      <section className="rs-new-post-panel" aria-label="Nuovo post">
        <NewPostForm onPublished={onPublished} />
      </section>
    )
  }

  return (
    <div className="rs-new-post-panel">
      <Button variant="primary" onClick={() => setOpen(true)}>
        Nuovo post
      </Button>
      <Modal show={open} onHide={() => setOpen(false)} centered aria-labelledby={titleId}>
        <Modal.Header closeButton>
          <Modal.Title id={titleId}>Nuovo post</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <NewPostForm
            onPublished={(notices) => {
              setOpen(false)
              onPublished(notices)
            }}
          />
        </Modal.Body>
      </Modal>
    </div>
  )
}

import { useId, useState } from 'react'
import { Button, Modal } from 'react-bootstrap'
import { Link, useLocation } from 'react-router'
import { ROUTES } from '@/app/routes'
import type { LoginRedirectState } from '@/components/guards/RequireAuth'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import DesktopMagnet from '@/components/motion/DesktopMagnet'
import { NewPostForm } from './NewPostForm'

type NewPostPanelProps = {
  /** Il post è stato pubblicato: gli avvisi da mostrare nella pagina. */
  onPublished: (notices: string[]) => void
}

/**
 * Dove si scrive un nuovo post (decisione dello studente, 25 ottobre, dopo il parere degli amici sul modulo sempre aperto):
 * a ogni larghezza un pulsante «Nuovo post» apre il modulo in una finestra, che si chiude a pubblicazione riuscita. Chi
 * non ha la sessione vede lo stesso pulsante: il clic porta all'accesso e, dopo, torna al feed.
 */
export function NewPostPanel({ onPublished }: NewPostPanelProps) {
  const user = useAppSelector(selectCurrentUser)
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const { pathname, search, hash } = useLocation()

  if (!user) {
    const state: LoginRedirectState = { from: pathname + search + hash, loginRequired: true }
    return (
      <DesktopMagnet>
        <Link className="btn btn-primary" to={ROUTES.login} state={state}>
          Nuovo post
        </Link>
      </DesktopMagnet>
    )
  }

  return (
    <>
      <DesktopMagnet>
        <Button variant="primary" onClick={() => setOpen(true)}>
          Nuovo post
        </Button>
      </DesktopMagnet>
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
    </>
  )
}

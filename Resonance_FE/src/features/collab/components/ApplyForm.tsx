import { useState, type FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import { Link, useLocation, useNavigate } from 'react-router'
import { chatPath, ROUTES } from '@/app/routes'
import type { LoginRedirectState } from '@/components/guards/RequireAuth'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { FieldError } from '@/components/ui/FieldError'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { getErrorMessage, getFieldErrors } from '@/lib/errors/getErrorMessage'
import type { ApplicationResponse, CollabPostResponse } from '@/types/collab'
import { isAlreadyApplied, useApplyToCollabPostMutation } from '../api/collabApi'
import { MESSAGE_MAX, validateApplication } from '../collabForm'

/**
 * Modulo di candidatura a un annuncio aperto (progettazione, sezione 6.7): un messaggio di 1–1800 caratteri che il
 * backend trasforma in un messaggio nella conversazione con l'autore (decisione 24). Una sola candidatura per annuncio
 * (decisioni 99 e 100): a invio riuscito, dopo un 409 `COLLAB_ALREADY_APPLIED` o se il dettaglio porta già la
 * conversazione (pagina ricaricata) il campo sparisce e resta il pulsante spento «Candidatura inviata», con «Apri la
 * chat» quando l'id della conversazione è noto (dopo il 409 arriva con il dettaglio riletto). Gli altri errori
 * (`COLLAB_CLOSED`, `CANNOT_APPLY_OWN_POST`, `TOO_MANY_REQUESTS`) mostrano il testo del loro codice e il messaggio
 * scritto resta. Un anonimo che invia va all'accesso e poi torna qui, come per il «Mi piace» del feed. Chi mostra il
 * modulo decide quando nasconderlo (proprio annuncio, annuncio chiuso).
 */
export function ApplyForm({ post }: { post: CollabPostResponse }) {
  const user = useAppSelector(selectCurrentUser)
  const navigate = useNavigate()
  const { pathname, search, hash } = useLocation()
  const [applyToCollabPost, { isLoading }] = useApplyToCollabPostMutation()
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [sent, setSent] = useState<ApplicationResponse | null>(null)

  // Dopo il primo invio il controllo del client segue il testo; l'errore di campo del server (VALIDATION_ERROR) lo sostituisce
  const fieldError = (submitted ? validateApplication(message) : undefined) ?? getFieldErrors(error).message

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!user) {
      const state: LoginRedirectState = { from: pathname + search + hash, loginRequired: true }
      navigate(ROUTES.login, { state })
      return
    }
    setSubmitted(true)
    setError(null)
    if (validateApplication(message)) return
    try {
      setSent(await applyToCollabPost({ id: post.id, message: message.trim() }).unwrap())
    } catch (failure) {
      setError(failure)
    }
  }

  const alreadyApplied = isAlreadyApplied(error)
  const conversationId = sent?.conversationId ?? post.applicationConversationId
  if (conversationId !== null || alreadyApplied) {
    return (
      <div className="rs-apply rs-apply--sent" role="status">
        <Button variant="primary" disabled>
          Candidatura inviata
        </Button>
        {conversationId !== null && (
          <Link className="btn btn-outline-light" to={chatPath(conversationId)}>
            Apri la chat
          </Link>
        )}
        {alreadyApplied && <p className="rs-field-hint">{getErrorMessage(error)}</p>}
      </div>
    )
  }

  return (
    <Form noValidate onSubmit={(event) => void submit(event)} className="rs-apply">
      <ErrorAlert error={Object.keys(getFieldErrors(error)).length === 0 ? error : null} />
      <fieldset disabled={isLoading} className="rs-fieldset">
        <Form.Group className="mb-3">
          <Form.Label htmlFor="apply-message">Messaggio per l'autore</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            id="apply-message"
            value={message}
            isInvalid={Boolean(fieldError)}
            aria-invalid={Boolean(fieldError)}
            aria-describedby={fieldError ? 'apply-message-error' : undefined}
            onChange={(event) => setMessage(event.target.value)}
          />
          <p className="rs-field-hint">
            {message.length} / {MESSAGE_MAX}
          </p>
          <FieldError id="apply-message-error" message={fieldError} />
        </Form.Group>
      </fieldset>
      <Button type="submit" variant="primary" disabled={isLoading} aria-busy={isLoading}>
        Invia candidatura
      </Button>
    </Form>
  )
}

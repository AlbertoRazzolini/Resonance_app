import { useState, type FormEvent } from 'react'
import { Alert, Button, Form } from 'react-bootstrap'
import { Link, useLocation, useNavigate } from 'react-router'
import { chatPath, ROUTES } from '@/app/routes'
import type { LoginRedirectState } from '@/components/guards/RequireAuth'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { FieldError } from '@/components/ui/FieldError'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { getFieldErrors } from '@/lib/errors/getErrorMessage'
import type { ContactResponse, IndieEventResponse, OfficialConcertResponse } from '@/types/events'
import { useContactConcertHostMutation, useContactIndieEventMusicianMutation } from '../api/eventsApi'
import { CONTACT_MESSAGE_MAX, validateContactMessage } from '../eventForm'

type ContactOrganizerProps =
  | { kind: 'official'; event: OfficialConcertResponse }
  | { kind: 'indie'; event: IndieEventResponse }

/**
 * «Contatta l'organizzatore» nel dettaglio di concerti e indie event (progettazione, sezione 6.6, decisione 69): un
 * messaggio di 1–1800 caratteri che il backend trasforma in un messaggio nella conversazione con l'organizzatore e che
 * sblocca la chat fino all'inizio dell'evento. A invio riuscito il modulo lascia il posto all'avviso con «Apri la chat»;
 * gli errori (`EVENT_CLOSED`, `CANNOT_CONTACT_OWN_EVENT`, `TOO_MANY_REQUESTS`) mostrano il testo del loro codice e il
 * messaggio resta scritto. Non compare per il proprio evento né per uno già iniziato; un anonimo che invia va
 * all'accesso e poi torna qui, come per le candidature.
 */
export function ContactOrganizer(props: ContactOrganizerProps) {
  const { kind, event } = props
  const organizer = props.kind === 'official' ? props.event.host : props.event.musician
  const user = useAppSelector(selectCurrentUser)
  const navigate = useNavigate()
  const { pathname, search, hash } = useLocation()
  const [contactHost, host] = useContactConcertHostMutation()
  const [contactMusician, musician] = useContactIndieEventMusicianMutation()
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [sent, setSent] = useState<ContactResponse | null>(null)
  // L'istante si prende una volta sola al montaggio (il render resta puro); se l'evento inizia con la pagina aperta, il
  // backend risponde 409 `EVENT_CLOSED` e il modulo mostra il suo testo
  const [openedAt] = useState(() => Date.now())
  const isLoading = host.isLoading || musician.isLoading

  // Il proprio evento e un evento già iniziato non si contattano (il backend risponderebbe 400 o 409)
  if (user?.id === organizer.id || Date.parse(event.eventDate) <= openedAt) return null

  // Dopo il primo invio il controllo del client segue il testo; l'errore di campo del server (VALIDATION_ERROR) lo sostituisce
  const fieldError = (submitted ? validateContactMessage(message) : undefined) ?? getFieldErrors(error).message

  async function send(sendEvent: FormEvent) {
    sendEvent.preventDefault()
    if (!user) {
      const state: LoginRedirectState = { from: pathname + search + hash, loginRequired: true }
      navigate(ROUTES.login, { state })
      return
    }
    setSubmitted(true)
    setError(null)
    if (validateContactMessage(message)) return
    const args = { id: event.id, message: message.trim() }
    try {
      setSent(await (kind === 'official' ? contactHost(args) : contactMusician(args)).unwrap())
    } catch (failure) {
      setError(failure)
    }
  }

  if (sent) {
    return (
      <section className="rs-contact" aria-labelledby="contact-title">
        <h2 id="contact-title">Contatta l'organizzatore</h2>
        <Alert variant="success" role="status">
          <p className="mb-2">Messaggio inviato. Puoi continuare la conversazione in chat.</p>
          <Link className="btn btn-primary btn-sm" to={chatPath(sent.conversationId)}>
            Apri la chat
          </Link>
        </Alert>
      </section>
    )
  }

  return (
    <section className="rs-contact" aria-labelledby="contact-title">
      <h2 id="contact-title">Contatta l'organizzatore</h2>
      <Form noValidate onSubmit={(formEvent) => void send(formEvent)} className="rs-apply">
        <ErrorAlert error={Object.keys(getFieldErrors(error)).length === 0 ? error : null} />
        <fieldset disabled={isLoading} className="rs-fieldset">
          <Form.Group className="mb-3">
            <Form.Label htmlFor="contact-message">Messaggio per l'organizzatore</Form.Label>
            <Form.Control
              as="textarea"
              rows={6}
              id="contact-message"
              value={message}
              isInvalid={Boolean(fieldError)}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? 'contact-message-error' : undefined}
              onChange={(changeEvent) => setMessage(changeEvent.target.value)}
            />
            <p className="rs-field-hint">
              {message.length} / {CONTACT_MESSAGE_MAX}
            </p>
            <FieldError id="contact-message-error" message={fieldError} />
          </Form.Group>
        </fieldset>
        <Button type="submit" variant="primary" disabled={isLoading} aria-busy={isLoading}>
          Invia messaggio
        </Button>
      </Form>
    </section>
  )
}

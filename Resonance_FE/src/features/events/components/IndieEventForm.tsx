import { useState, type FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router'
import { indieEventPath, ROUTES } from '@/app/routes'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import type { IndieEventStatus } from '@/types/events'
import { useCreateIndieEventMutation } from '../api/eventsApi'
import { buildIndieEventRequest, useEventFormState } from '../eventForm'
import { EventFormFields } from './EventFormFields'

/**
 * Form «Pubblica indie event» (solo MUSICIAN; progettazione, sezioni 6.6 e 10.1). Gli stessi campi del concerto più
 * «Ingresso gratuito»; «Pubblica» crea l'evento visibile a tutti, «Salva come bozza» lo crea visibile solo a chi lo
 * scrive. Attesa della geocodifica ed errori come nel concerto. A creazione riuscita si apre il dettaglio.
 */
export function IndieEventForm() {
  const navigate = useNavigate()
  const [createIndieEvent, { isLoading }] = useCreateIndieEventMutation()
  const form = useEventFormState('indie')
  // Quale pulsante ha inviato: è quello che mostra l'attesa della geocodifica
  const [submitting, setSubmitting] = useState<IndieEventStatus>('PUBLISHED')

  async function submit(event: FormEvent | null, status: IndieEventStatus) {
    event?.preventDefault()
    if (!form.validate()) return
    setSubmitting(status)
    try {
      const created = await createIndieEvent(buildIndieEventRequest(form.values, status)).unwrap()
      navigate(indieEventPath(created.id))
    } catch (error) {
      form.fail(error)
    }
  }

  const waiting = "Sto cercando l'indirizzo…"
  return (
    <Form noValidate onSubmit={(event) => void submit(event, 'PUBLISHED')}>
      <ErrorAlert error={form.alertError} />
      <fieldset disabled={isLoading} className="rs-fieldset">
        <EventFormFields kind="indie" values={form.values} errors={form.errors} onChange={form.change} />
      </fieldset>
      <div className="rs-form-actions" aria-live="polite">
        <Link to={ROUTES.profile} className="btn btn-outline-light">
          Annulla
        </Link>
        <Button
          type="button"
          variant="outline-light"
          disabled={isLoading}
          onClick={() => void submit(null, 'DRAFT')}
        >
          {isLoading && submitting === 'DRAFT' ? waiting : 'Salva come bozza'}
        </Button>
        <Button type="submit" variant="primary" disabled={isLoading} aria-busy={isLoading}>
          {isLoading && submitting === 'PUBLISHED' ? waiting : 'Pubblica'}
        </Button>
      </div>
    </Form>
  )
}

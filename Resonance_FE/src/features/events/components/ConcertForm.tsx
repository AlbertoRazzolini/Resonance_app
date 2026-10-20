import type { FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router'
import { concertPath, ROUTES } from '@/app/routes'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useCreateConcertMutation } from '../api/eventsApi'
import { buildConcertRequest, useEventFormState } from '../eventForm'
import { EventFormFields } from './EventFormFields'

/**
 * Form «Pubblica concerto» (solo HOST; progettazione, sezioni 6.6 e 10.1). Il backend geocodifica l'indirizzo e può
 * metterci fino a circa 15 s: finché risponde il pulsante dice «Sto cercando l'indirizzo…» e i campi sono fermi.
 * `ADDRESS_NOT_FOUND` evidenzia l'indirizzo; `GEOCODING_UNAVAILABLE` e `TOO_MANY_REQUESTS` sono un avviso e si può
 * riprovare. A creazione riuscita si apre il dettaglio.
 */
export function ConcertForm() {
  const navigate = useNavigate()
  const [createConcert, { isLoading }] = useCreateConcertMutation()
  const form = useEventFormState('concert')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.validate()) return
    try {
      const concert = await createConcert(buildConcertRequest(form.values)).unwrap()
      navigate(concertPath(concert.id))
    } catch (error) {
      form.fail(error)
    }
  }

  return (
    <Form noValidate onSubmit={(event) => void handleSubmit(event)}>
      <ErrorAlert error={form.alertError} />
      <fieldset disabled={isLoading} className="rs-fieldset">
        <EventFormFields kind="concert" values={form.values} errors={form.errors} onChange={form.change} />
      </fieldset>
      <div className="rs-form-actions" aria-live="polite">
        <Link to={ROUTES.profile} className="btn btn-outline-light">
          Annulla
        </Link>
        <Button type="submit" variant="primary" disabled={isLoading} aria-busy={isLoading}>
          {isLoading ? "Sto cercando l'indirizzo…" : 'Pubblica concerto'}
        </Button>
      </div>
    </Form>
  )
}

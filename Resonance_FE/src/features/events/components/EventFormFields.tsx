import { useState } from 'react'
import { Form } from 'react-bootstrap'
import { DateTimeField } from '@/components/ui/DateTimeField'
import { FieldError } from '@/components/ui/FieldError'
import { GenreInput } from '@/components/ui/GenreInput'
import { DESCRIPTION_MAX, type EventErrors, type EventFormKind, type EventFormValues } from '../eventForm'

type EventFormFieldsProps = {
  kind: EventFormKind
  values: EventFormValues
  errors: EventErrors
  onChange: (patch: Partial<EventFormValues>) => void
}

/**
 * Campi comuni ai form di concerto e indie event (progettazione, sezione 6.6), in una colonna. Il biglietto esiste solo
 * nel concerto, «Ingresso gratuito» solo nell'indie event. L'indirizzo lo geocodifica il backend: qui è solo testo.
 */
export function EventFormFields({ kind, values, errors, onChange }: EventFormFieldsProps) {
  // La data minima si calcola una volta: il selettore del browser non lascia scegliere un giorno passato
  const [now] = useState(() => new Date())

  const text = (field: 'title' | 'venueName' | 'address' | 'coverImageUrl' | 'externalTicketUrl', id: string) => ({
    id,
    value: values[field],
    isInvalid: Boolean(errors[field]),
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? `${id}-error` : undefined,
    onChange: (event: { target: { value: string } }) => onChange({ [field]: event.target.value }),
  })

  return (
    <>
      <Form.Group className="mb-4">
        <Form.Label htmlFor="event-title" className="rs-required">
          Titolo
        </Form.Label>
        <Form.Control type="text" {...text('title', 'event-title')} />
        <FieldError id="event-title-error" message={errors.title} />
      </Form.Group>
      <Form.Group className="mb-4">
        <Form.Label htmlFor="event-description">Descrizione</Form.Label>
        <Form.Control
          as="textarea"
          rows={5}
          id="event-description"
          value={values.description}
          isInvalid={Boolean(errors.description)}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? 'event-description-error' : undefined}
          onChange={(event) => onChange({ description: event.target.value })}
        />
        <p className="rs-field-hint">
          {values.description.length} / {DESCRIPTION_MAX}
        </p>
        <FieldError id="event-description-error" message={errors.description} />
      </Form.Group>
      <Form.Group className="mb-4">
        <Form.Label htmlFor="event-venue" className="rs-required">
          Nome del locale
        </Form.Label>
        <Form.Control type="text" {...text('venueName', 'event-venue')} />
        <FieldError id="event-venue-error" message={errors.venueName} />
      </Form.Group>
      <Form.Group className="mb-4">
        <Form.Label htmlFor="event-address" className="rs-required">
          Indirizzo
        </Form.Label>
        <Form.Control type="text" autoComplete="street-address" {...text('address', 'event-address')} />
        <p className="rs-field-hint">Via, numero e città: lo cerchiamo sulla mappa</p>
        <FieldError id="event-address-error" message={errors.address} />
      </Form.Group>
      <DateTimeField
        id="event-date"
        label="Data e ora"
        required
        min={now}
        value={values.eventDate}
        onChange={(eventDate) => onChange({ eventDate })}
        error={errors.eventDate}
      />
      <GenreInput
        id="event-genres"
        tags={values.genreTags}
        onChange={(genreTags) => onChange({ genreTags })}
        error={errors.genreTags}
      />
      <Form.Group className="mb-4">
        <Form.Label htmlFor="event-cover">Indirizzo della copertina</Form.Label>
        <Form.Control type="url" inputMode="url" placeholder="Incolla il link dell'immagine di copertina" {...text('coverImageUrl', 'event-cover')} />
        <FieldError id="event-cover-error" message={errors.coverImageUrl} />
      </Form.Group>
      {kind === 'concert' ? (
        <Form.Group className="mb-4">
          <Form.Label htmlFor="event-ticket">Indirizzo per i biglietti</Form.Label>
          <Form.Control type="url" inputMode="url" placeholder="Incolla qui il link per comprare i biglietti" {...text('externalTicketUrl', 'event-ticket')} />
          <FieldError id="event-ticket-error" message={errors.externalTicketUrl} />
        </Form.Group>
      ) : (
        <Form.Group className="mb-4">
          <Form.Check
            type="switch"
            id="event-free"
            label="Ingresso gratuito"
            checked={values.isFree}
            onChange={(event) => onChange({ isFree: event.target.checked })}
          />
        </Form.Group>
      )}
    </>
  )
}

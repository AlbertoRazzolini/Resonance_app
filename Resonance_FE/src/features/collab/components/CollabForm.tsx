import type { FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router'
import { collabPath, ROUTES } from '@/app/routes'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { FieldError } from '@/components/ui/FieldError'
import { GenreInput } from '@/components/ui/GenreInput'
import { useFocusFirstInvalid } from '@/hooks/useFocusFirstInvalid'
import { useCreateCollabPostMutation } from '../api/collabApi'
import {
  buildCollabRequest,
  DESCRIPTION_MAX,
  useCollabFormState,
  type CollabFormValues,
} from '../collabForm'

type TextField = 'title' | 'roleNeeded' | 'location'

const IDS: Record<TextField, string> = { title: 'collab-title', roleNeeded: 'collab-role', location: 'collab-location' }

/**
 * Modulo «Pubblica annuncio» (solo MUSICIAN; progettazione, sezione 6.7): titolo, descrizione, ruolo cercato, generi e
 * luogo facoltativo (testo libero, non geocodificato). Errori dei campi come nel modulo degli eventi; a creazione
 * riuscita si apre il dettaglio.
 */
export function CollabForm() {
  const navigate = useNavigate()
  const [createCollabPost, { isLoading }] = useCreateCollabPostMutation()
  const form = useCollabFormState()
  const formRef = useFocusFirstInvalid(form.invalidAttempts)
  const { values, errors } = form

  // Le impostazioni comuni di un campo di testo: valore, stato d'errore e collegamento al messaggio
  const text = (field: TextField) => ({
    id: IDS[field],
    value: values[field],
    isInvalid: Boolean(errors[field]),
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? `${IDS[field]}-error` : undefined,
    onChange: (event: { target: { value: string } }) => form.change({ [field]: event.target.value } as Partial<CollabFormValues>),
  })

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.validate()) return
    try {
      const created = await createCollabPost(buildCollabRequest(values)).unwrap()
      navigate(collabPath(created.id))
    } catch (error) {
      form.fail(error)
    }
  }

  return (
    <Form ref={formRef} noValidate onSubmit={(event) => void submit(event)}>
      <ErrorAlert error={form.alertError} />
      <fieldset disabled={isLoading} className="rs-fieldset">
        <Form.Group className="mb-4">
          <Form.Label htmlFor={IDS.title} className="rs-required">
            Titolo
          </Form.Label>
          <Form.Control type="text" {...text('title')} />
          <FieldError id={`${IDS.title}-error`} message={errors.title} />
        </Form.Group>

        <Form.Group className="mb-4">
          <Form.Label htmlFor="collab-description" className="rs-required">
            Descrizione
          </Form.Label>
          <Form.Control
            as="textarea"
            rows={5}
            id="collab-description"
            value={values.description}
            isInvalid={Boolean(errors.description)}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'collab-description-error' : undefined}
            onChange={(event) => form.change({ description: event.target.value })}
          />
          <p className="rs-field-hint">
            {values.description.length} / {DESCRIPTION_MAX}
          </p>
          <FieldError id="collab-description-error" message={errors.description} />
        </Form.Group>

        <Form.Group className="mb-4">
          <Form.Label htmlFor={IDS.roleNeeded} className="rs-required">
            Ruolo cercato
          </Form.Label>
          <Form.Control
            type="text"
            {...text('roleNeeded')}
            aria-describedby={`${IDS.roleNeeded}-hint${errors.roleNeeded ? ` ${IDS.roleNeeded}-error` : ''}`}
          />
          <p id={`${IDS.roleNeeded}-hint`} className="rs-field-hint">
            Per esempio: bassista
          </p>
          <FieldError id={`${IDS.roleNeeded}-error`} message={errors.roleNeeded} />
        </Form.Group>

        <GenreInput
          id="collab-genres"
          tags={values.genreTags}
          onChange={(genreTags) => form.change({ genreTags })}
          error={errors.genreTags}
        />

        <Form.Group className="mb-4">
          <Form.Label htmlFor={IDS.location}>Luogo (facoltativo)</Form.Label>
          <Form.Control type="text" {...text('location')} />
          <FieldError id={`${IDS.location}-error`} message={errors.location} />
        </Form.Group>
      </fieldset>

      <div className="rs-form-actions" aria-live="polite">
        <Link to={ROUTES.collab} className="btn btn-outline-light">
          Annulla
        </Link>
        <Button type="submit" variant="primary" disabled={isLoading} aria-busy={isLoading}>
          Pubblica
        </Button>
      </div>
    </Form>
  )
}

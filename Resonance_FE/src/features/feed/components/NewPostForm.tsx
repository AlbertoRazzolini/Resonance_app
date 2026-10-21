import { useState, type FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { FieldError } from '@/components/ui/FieldError'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { useBrowserPosition } from '@/hooks/useBrowserPosition'
import { getFieldErrors } from '@/lib/errors/getErrorMessage'
import { useCreatePostMutation } from '../api/feedApi'
import { buildPostRequest, POST_BODY_MAX, validatePost, type PostValues } from '../postForm'

type NewPostFormProps = {
  /** Il post è stato pubblicato: gli avvisi da mostrare («Post pubblicato.» e, se serve, quello sulla posizione). */
  onPublished: (notices: string[]) => void
}

const EMPTY: PostValues = { body: '', imageUrl: '' }

/**
 * Modulo «Nuovo post» (progettazione, sezione 6.8): testo 1–2000, indirizzo dell'immagine facoltativo (solo URL, D2) e
 * casella «Aggiungi la mia posizione». La posizione si chiede al browser solo all'invio e solo con la casella
 * spuntata (decisione 30); se il browser non la dà si usa quella del profilo, se c'è, e in ogni caso un avviso dice
 * che cosa è successo. I controlli del client seguono quelli del backend; gli errori dei campi del server compaiono
 * sotto i campi e il testo scritto resta.
 */
export function NewPostForm({ onPublished }: NewPostFormProps) {
  const user = useAppSelector(selectCurrentUser)
  const { request } = useBrowserPosition()
  const [createPost, { isLoading, error, reset }] = useCreatePostMutation()
  const [values, setValues] = useState<PostValues>(EMPTY)
  const [withPosition, setWithPosition] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  // Il browser può impiegare qualche secondo a rispondere: il pulsante aspetta anche lui
  const [locating, setLocating] = useState(false)

  // Dopo il primo invio i messaggi dei campi seguono quello che si scrive
  const clientErrors = submitted ? validatePost(values) : {}
  const serverFields = getFieldErrors(error)
  const errorOf = (field: keyof PostValues) => clientErrors[field] ?? serverFields[field]
  // Un errore con i campi si legge sotto i campi, gli altri come avviso in cima
  const alertError = Object.keys(serverFields).length > 0 ? null : error
  const busy = isLoading || locating

  const set = (field: keyof PostValues) => (value: string) => setValues((current) => ({ ...current, [field]: value }))

  /** Posizione da inviare e avviso da dire: GPS, poi profilo, poi niente (decisione dello studente, 21 ottobre). */
  async function choosePosition(): Promise<{ position: { latitude: number; longitude: number } | null; notice?: string }> {
    if (!withPosition) return { position: null }
    setLocating(true)
    const gps = await request()
    setLocating(false)
    if (gps) return { position: gps }
    if (user?.latitude != null && user.longitude != null) {
      return { position: { latitude: user.latitude, longitude: user.longitude }, notice: 'Uso la posizione del tuo profilo.' }
    }
    return { position: null, notice: 'Posizione non disponibile: il post è stato pubblicato senza.' }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validatePost(values)).length > 0) return
    reset()
    const { position, notice } = await choosePosition()
    try {
      await createPost(buildPostRequest(values, position)).unwrap()
      setValues(EMPTY)
      setWithPosition(false)
      setSubmitted(false)
      onPublished(['Post pubblicato.', ...(notice ? [notice] : [])])
    } catch {
      // L'errore lo mostra il modulo, dallo stato della mutazione
    }
  }

  const control = (field: keyof PostValues, id: string) => ({
    id,
    value: values[field],
    isInvalid: Boolean(errorOf(field)),
    'aria-invalid': Boolean(errorOf(field)),
    'aria-describedby': errorOf(field) ? `${id}-error` : undefined,
    onChange: (event: { target: { value: string } }) => set(field)(event.target.value),
  })

  return (
    <Form noValidate onSubmit={(event) => void handleSubmit(event)} className="rs-new-post">
      <ErrorAlert error={alertError} />
      <Form.Group className="mb-3">
        <Form.Label htmlFor="post-body">Cosa vuoi condividere?</Form.Label>
        <Form.Control as="textarea" rows={3} {...control('body', 'post-body')} />
        <p className="rs-field-hint">
          {values.body.length} / {POST_BODY_MAX}
        </p>
        <FieldError id="post-body-error" message={errorOf('body')} />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label htmlFor="post-image">Indirizzo dell'immagine (facoltativo)</Form.Label>
        <Form.Control type="url" inputMode="url" placeholder="https://…" {...control('imageUrl', 'post-image')} />
        <FieldError id="post-image-error" message={errorOf('imageUrl')} />
      </Form.Group>
      <Form.Check
        id="post-position"
        type="checkbox"
        className="mb-3"
        label="Aggiungi la mia posizione"
        checked={withPosition}
        onChange={(event) => setWithPosition(event.target.checked)}
      />
      <div className="rs-form-actions">
        <Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>
          {busy ? 'Pubblico…' : 'Pubblica'}
        </Button>
      </div>
    </Form>
  )
}

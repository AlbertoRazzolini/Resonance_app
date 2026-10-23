import { useState, type FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router'
import { ROUTES } from '@/app/routes'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { FieldError } from '@/components/ui/FieldError'
import { getFieldErrors } from '@/lib/errors/getErrorMessage'
import type { MeResponse } from '@/types/users'
import DesktopMagnet from '@/components/motion/DesktopMagnet'
import { useUpdateProfileMutation } from '../api/usersApi'
import {
  BIO_MAX,
  buildProfilePatch,
  profileValues,
  validateProfile,
  type ProfileLocationState,
  type ProfileValues,
} from '../profilePatch'

const FIELDS = ['displayName', 'bio', 'city', 'avatarUrl'] as const

/**
 * Form dei dati del profilo (progettazione, sezione 6.5): «Salva» si accende solo se qualcosa è cambiato e il PATCH
 * porta i soli campi cambiati (decisione 31). I controlli del client seguono quelli del backend e non chiamano il
 * server se qualcosa non va; gli errori dei campi del server compaiono sotto i campi. A salvataggio riuscito la
 * sessione ha già il profilo nuovo (`usersApi`) e si torna a `/profilo` con il segno per l'avviso.
 */
export function ProfileForm({ user }: { user: MeResponse }) {
  const navigate = useNavigate()
  const [updateProfile, { isLoading, error }] = useUpdateProfileMutation()
  const saved = profileValues(user)
  const [values, setValues] = useState<ProfileValues>(saved)
  const [submitted, setSubmitted] = useState(false)

  // Cambiato = un campo differisce dal salvato dopo il trim; il nome svuotato conta, così l'errore si può vedere
  const dirty = FIELDS.some((field) => values[field].trim() !== saved[field])
  // Dopo il primo invio i messaggi dei campi seguono quello che si scrive
  const clientErrors = submitted ? validateProfile(values) : {}
  const serverFields = getFieldErrors(error)
  const errorOf = (field: keyof ProfileValues) => clientErrors[field] ?? serverFields[field]

  const set = (field: keyof ProfileValues) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateProfile(values)).length > 0) return
    try {
      await updateProfile(buildProfilePatch(values, saved)).unwrap()
      const state: ProfileLocationState = { profileUpdated: true }
      navigate(ROUTES.profile, { state })
    } catch {
      // L'errore lo mostra il form, dallo stato della mutazione
    }
  }

  const control = (field: keyof ProfileValues, id: string) => ({
    id,
    value: values[field],
    isInvalid: Boolean(errorOf(field)),
    'aria-invalid': Boolean(errorOf(field)),
    'aria-describedby': errorOf(field) ? `${id}-error` : undefined,
    onChange: (event: { target: { value: string } }) => set(field)(event.target.value),
  })

  return (
    <Form noValidate onSubmit={(event) => void handleSubmit(event)}>
      <ErrorAlert error={error} />
      <Form.Group className="mb-4">
        <Form.Label htmlFor="profile-name" className="rs-required">
          Nome utente
        </Form.Label>
        <Form.Control type="text" autoComplete="nickname" {...control('displayName', 'profile-name')} />
        <FieldError id="profile-name-error" message={errorOf('displayName')} />
      </Form.Group>
      <Form.Group className="mb-4">
        <Form.Label htmlFor="profile-bio">Bio</Form.Label>
        <Form.Control as="textarea" rows={4} {...control('bio', 'profile-bio')} />
        <p className="rs-field-hint">
          {values.bio.length} / {BIO_MAX}
        </p>
        <FieldError id="profile-bio-error" message={errorOf('bio')} />
      </Form.Group>
      <Form.Group className="mb-4">
        <Form.Label htmlFor="profile-city">Città</Form.Label>
        <Form.Control type="text" autoComplete="address-level2" {...control('city', 'profile-city')} />
        <FieldError id="profile-city-error" message={errorOf('city')} />
      </Form.Group>
      <Form.Group className="mb-4">
        <Form.Label htmlFor="profile-avatar">Indirizzo della foto</Form.Label>
        <Form.Control
          type="url"
          inputMode="url"
          placeholder="https://…"
          {...control('avatarUrl', 'profile-avatar')}
        />
        <FieldError id="profile-avatar-error" message={errorOf('avatarUrl')} />
      </Form.Group>
      <div className="rs-form-actions">
        <Link to={ROUTES.profile} className="btn btn-outline-light">
          Annulla
        </Link>
        <DesktopMagnet>
          <Button type="submit" variant="primary" disabled={!dirty || isLoading}>
            Salva modifiche
          </Button>
        </DesktopMagnet>
      </div>
    </Form>
  )
}

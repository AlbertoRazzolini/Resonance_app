import { useState, type FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import { Link, useLocation, useNavigate } from 'react-router'
import { ROUTES } from '@/app/routes'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { FieldError } from '@/components/ui/FieldError'
import { getErrorCode, getFieldErrors } from '@/lib/errors/getErrorMessage'
import { useRegisterMutation } from '../api/authApi'
import { AuthCard } from '../components/AuthCard'
import { PasswordField } from '../components/PasswordField'
import { readAuthState } from '../locationState'
import { validateRegister, type RegisterValues } from '../validation'

/**
 * Pagina di registrazione (progettazione, sezione 4.4). I controlli del client seguono le regole del backend e
 * non chiamano il server se qualcosa non va; gli errori del server (`VALIDATION_ERROR` con i campi, email già
 * registrata, troppi tentativi) compaiono sotto i campi o in un avviso. A registrazione riuscita si va a
 * `/verifica` con l'email già pronta, il segno che il codice è appena partito e la pagina richiesta (stato del
 * router, decisione 82).
 */
export function Component() {
  const location = useLocation()
  const navigate = useNavigate()
  const { from } = readAuthState(location.state)
  const [register, { isLoading, error }] = useRegisterMutation()
  const [values, setValues] = useState<RegisterValues>({ displayName: '', email: '', password: '' })
  const [submitted, setSubmitted] = useState(false)

  // Dopo il primo invio i messaggi dei campi seguono quello che si scrive
  const clientErrors = submitted ? validateRegister(values) : {}
  // Errori dei campi dal server, solo per i campi che il form ha: un nome di campo nuovo lascia l'avviso generico
  const serverFields = getFieldErrors(error)
  const errorOf = (field: keyof RegisterValues) => clientErrors[field] ?? serverFields[field]

  const set = (field: keyof RegisterValues) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateRegister(values)).length > 0) return
    const email = values.email.trim()
    try {
      await register({
        email,
        password: values.password,
        displayName: values.displayName.trim(),
      }).unwrap()
      navigate(ROUTES.verify, { state: { email, codeSent: true, ...(from ? { from } : {}) } })
    } catch {
      // L'errore lo mostra la pagina, dallo stato della mutazione
    }
  }

  return (
    <AuthCard
      title="Crea il tuo account"
      aside={
        <>
          Hai già un account?{' '}
          <Link to={ROUTES.login} state={from ? { from } : undefined}>
            Accedi
          </Link>
        </>
      }
    >
      <ErrorAlert error={error} />
      {getErrorCode(error) === 'EMAIL_ALREADY_REGISTERED' && (
        <p>
          <Link to={ROUTES.login} state={from ? { from } : undefined}>
            Vai all'accesso
          </Link>
        </p>
      )}
      <Form noValidate onSubmit={(event) => void handleSubmit(event)}>
        <Form.Group className="mb-4">
          <Form.Label htmlFor="register-name" className="rs-required">
            Nome visibile
          </Form.Label>
          <Form.Control
            id="register-name"
            type="text"
            value={values.displayName}
            autoComplete="nickname"
            placeholder="Come ti vedranno gli altri"
            isInvalid={Boolean(errorOf('displayName'))}
            aria-invalid={Boolean(errorOf('displayName'))}
            aria-describedby={errorOf('displayName') ? 'register-name-error' : undefined}
            onChange={(event) => set('displayName')(event.target.value)}
          />
          <FieldError id="register-name-error" message={errorOf('displayName')} />
        </Form.Group>
        <Form.Group className="mb-4">
          <Form.Label htmlFor="register-email" className="rs-required">
            Email
          </Form.Label>
          <Form.Control
            id="register-email"
            type="email"
            value={values.email}
            autoComplete="email"
            placeholder="tuonome@dominio.it"
            isInvalid={Boolean(errorOf('email'))}
            aria-invalid={Boolean(errorOf('email'))}
            aria-describedby={errorOf('email') ? 'register-email-error' : undefined}
            onChange={(event) => set('email')(event.target.value)}
          />
          <FieldError id="register-email-error" message={errorOf('email')} />
        </Form.Group>
        <PasswordField
          label="Password"
          value={values.password}
          onChange={set('password')}
          autoComplete="new-password"
          error={errorOf('password')}
          showByteCount
        />
        <Button
          type="submit"
          variant="primary"
          className="rs-auth-submit w-100"
          disabled={isLoading}
        >
          <span className="rs-auth-submit__label">Registrati</span>
        </Button>
      </Form>
    </AuthCard>
  )
}

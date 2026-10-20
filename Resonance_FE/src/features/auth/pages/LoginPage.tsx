import { useState, type FormEvent } from 'react'
import { Alert, Button, Form } from 'react-bootstrap'
import { Link, useLocation } from 'react-router'
import { ROUTES } from '@/app/routes'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { FieldError } from '@/components/ui/FieldError'
import { useAppSelector } from '@/hooks/redux'
import { suspensionOf } from '@/lib/api/apiSlice'
import { getErrorCode } from '@/lib/errors/getErrorMessage'
import { useLoginMutation } from '../api/authApi'
import { AuthCard } from '../components/AuthCard'
import { PasswordField } from '../components/PasswordField'
import { SuspendedNotice } from '../components/SuspendedNotice'
import { readAuthState } from '../locationState'

/**
 * Pagina di accesso (progettazione, sezione 4.7). Un messaggio per ogni esito del backend: credenziali sbagliate,
 * email non verificata (con il collegamento alla verifica), troppi tentativi e account sospeso (con
 * `SuspendedNotice`). A sessione aperta il ritorno alla pagina richiesta lo fa `RedirectIfAuthenticated`.
 */
export function Component() {
  const location = useLocation()
  const { from, passwordChanged } = readAuthState(location.state)
  const suspension = useAppSelector((state) => state.auth.suspension)
  const [login, { isLoading, error }] = useLoginMutation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [sentEmail, setSentEmail] = useState('')

  // Dopo il primo invio i messaggi dei campi seguono quello che si scrive: spariscono appena il campo è giusto
  const emailError = submitted && !email.trim() ? 'Scrivi la tua email.' : undefined
  const passwordError = submitted && !password ? 'Scrivi la password.' : undefined

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    const trimmed = email.trim()
    if (!trimmed || !password) return
    setSentEmail(trimmed)
    await login({ email: trimmed, password })
  }

  const code = getErrorCode(error)
  // La sospensione arriva dal login appena fallito oppure dal refresh che ha chiuso la sessione (store)
  const suspensionDetails =
    code === 'ACCOUNT_SUSPENDED'
      ? suspensionOf((error as { data: unknown }).data)
      : (!error && suspension) || null

  return (
    <>
      {suspensionDetails && <SuspendedNotice details={suspensionDetails} />}
      <AuthCard
        title="Accedi"
        aside={
          <>
            Non hai un account?{' '}
            <Link to={ROUTES.register} state={from ? { from } : undefined}>
              Registrati qui
            </Link>
          </>
        }
      >
        {passwordChanged && (
          <Alert variant="success">Password cambiata. Accedi con la nuova password.</Alert>
        )}
        {code !== 'ACCOUNT_SUSPENDED' && <ErrorAlert error={error} />}
        {code === 'EMAIL_NOT_VERIFIED' && (
          <p>
            <Link to={ROUTES.verify} state={{ email: sentEmail, ...(from ? { from } : {}) }}>
              Inserisci il codice
            </Link>
          </p>
        )}
        <Form noValidate onSubmit={(event) => void handleSubmit(event)}>
          <Form.Group className="mb-4">
            <Form.Label htmlFor="login-email" className="rs-required">
              Email
            </Form.Label>
            <Form.Control
              id="login-email"
              type="email"
              value={email}
              autoComplete="username"
              placeholder="tuonome@dominio.it"
              isInvalid={Boolean(emailError)}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? 'login-email-error' : undefined}
              onChange={(event) => setEmail(event.target.value)}
            />
            <FieldError id="login-email-error" message={emailError} />
          </Form.Group>
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            error={passwordError}
            aside={<Link to={ROUTES.forgotPassword}>Password dimenticata?</Link>}
          />
          <Button
            type="submit"
            variant="primary"
            className="rs-auth-submit w-100"
            disabled={isLoading}
          >
            <span className="rs-auth-submit__label">Entra</span>
            <span className="rs-auth-submit__hint">…nella Zona</span>
          </Button>
        </Form>
      </AuthCard>
    </>
  )
}

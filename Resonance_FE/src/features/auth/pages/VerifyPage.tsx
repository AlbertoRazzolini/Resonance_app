import { useState, type FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import { Link, useLocation } from 'react-router'
import { ROUTES } from '@/app/routes'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { FieldError } from '@/components/ui/FieldError'
import { suspensionOf } from '@/lib/api/apiSlice'
import { getErrorCode, getErrorMessage, getFieldErrors } from '@/lib/errors/getErrorMessage'
import { useVerifyMutation } from '../api/authApi'
import { AuthCard } from '../components/AuthCard'
import { OtpField } from '../components/OtpField'
import { PasswordField } from '../components/PasswordField'
import { ResendCode } from '../components/ResendCode'
import { SuspendedNotice } from '../components/SuspendedNotice'
import { readAuthState } from '../locationState'
import { validateVerify, type VerifyValues } from '../validation'

/** Errori che si mostrano sotto le caselle del codice, non in un avviso in alto. */
const CODE_ERRORS = ['CODE_INVALID', 'CODE_EXPIRED']

/**
 * Pagina di verifica dell'email (progettazione, sezione 4.5): email (già scritta se si arriva dalla registrazione o
 * dall'accesso, ma modificabile), codice a 6 cifre e password. Gli errori del codice stanno sotto le caselle, che
 * restano riempite e diventano rosse; la sospensione ha la sua scheda. A sessione aperta il ritorno alla pagina
 * richiesta lo fa `RedirectIfAuthenticated`.
 */
export function Component() {
  const location = useLocation()
  const { from, email: stateEmail, codeSent } = readAuthState(location.state)
  const [verify, { isLoading, error }] = useVerifyMutation()
  const [values, setValues] = useState<VerifyValues>({
    email: stateEmail ?? '',
    code: '',
    password: '',
  })
  const [submitted, setSubmitted] = useState(false)

  const clientErrors = submitted ? validateVerify(values) : {}
  const backendCode = getErrorCode(error)
  const serverFields = getFieldErrors(error)
  const codeError =
    clientErrors.code ??
    (backendCode && CODE_ERRORS.includes(backendCode) ? getErrorMessage(error) : serverFields.code)
  const suspended = backendCode === 'ACCOUNT_SUSPENDED'
  // CODE_* stanno sotto le caselle e la sospensione ha la sua scheda: gli altri errori vanno nell'avviso in alto
  const alertError = backendCode && (CODE_ERRORS.includes(backendCode) || suspended) ? null : error

  const set = (field: keyof VerifyValues) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateVerify(values)).length > 0) return
    await verify({ email: values.email.trim(), code: values.code, password: values.password })
  }

  return (
    <>
      {suspended && <SuspendedNotice details={suspensionOf((error as { data: unknown }).data)} />}
      <AuthCard title="Verifica la tua email">
        <p className="text-body-secondary">
          Abbiamo inviato un codice a 6 cifre alla tua email. Inseriscilo per confermare la tua
          identità da palco.
        </p>
        <ErrorAlert error={alertError} />
        {backendCode === 'ALREADY_VERIFIED' && (
          <p>
            <Link to={ROUTES.login} state={from ? { from } : undefined}>
              Vai all'accesso
            </Link>
          </p>
        )}
        <Form noValidate onSubmit={(event) => void handleSubmit(event)}>
          <Form.Group className="mb-4">
            <Form.Label htmlFor="verify-email" className="rs-required">
              Email
            </Form.Label>
            <Form.Control
              id="verify-email"
              type="email"
              value={values.email}
              autoComplete="email"
              placeholder="tuonome@dominio.it"
              isInvalid={Boolean(clientErrors.email ?? serverFields.email)}
              aria-invalid={Boolean(clientErrors.email ?? serverFields.email)}
              aria-describedby={
                (clientErrors.email ?? serverFields.email) ? 'verify-email-error' : undefined
              }
              onChange={(event) => set('email')(event.target.value)}
            />
            <FieldError
              id="verify-email-error"
              message={clientErrors.email ?? serverFields.email}
            />
          </Form.Group>
          <OtpField value={values.code} onChange={set('code')} error={codeError} />
          <PasswordField
            label="Password"
            value={values.password}
            onChange={set('password')}
            autoComplete="current-password"
            error={clientErrors.password ?? serverFields.password}
          />
          <Button
            type="submit"
            variant="primary"
            className="rs-auth-submit w-100"
            disabled={isLoading}
          >
            <span className="rs-auth-submit__label">Verifica</span>
          </Button>
        </Form>
        <ResendCode email={values.email} initiallyWaiting={Boolean(codeSent)} />
      </AuthCard>
    </>
  )
}

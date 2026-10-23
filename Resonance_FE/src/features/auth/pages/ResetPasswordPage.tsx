import { useState, type FormEvent } from 'react'
import { Alert, Button, Form } from 'react-bootstrap'
import { useLocation, useNavigate } from 'react-router'
import { ROUTES } from '@/app/routes'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { FieldError } from '@/components/ui/FieldError'
import { suspensionOf } from '@/lib/api/apiSlice'
import { getErrorCode, getErrorMessage, getFieldErrors } from '@/lib/errors/getErrorMessage'
import DesktopMagnet from '@/components/motion/DesktopMagnet'
import { useResetPasswordMutation } from '../api/authApi'
import { AuthCard } from '../components/AuthCard'
import { OtpField } from '../components/OtpField'
import { PasswordField } from '../components/PasswordField'
import { ResendCode } from '../components/ResendCode'
import { SuspendedNotice } from '../components/SuspendedNotice'
import { readAuthState } from '../locationState'
import { validateReset, type ResetValues } from '../validation'

/**
 * Reset della password (progettazione, sezione 4.10): email (già scritta se si arriva da "password dimenticata", ma
 * modificabile), codice a 6 cifre e nuova password. Ogni codice non valido è `CODE_INVALID` (decisione 51), mostrato
 * sotto le caselle. A successo la sessione si chiude (lo fa l'endpoint) e si va all'accesso con l'avviso verde.
 */
export function Component() {
  const location = useLocation()
  const navigate = useNavigate()
  const { email: stateEmail, codeSent } = readAuthState(location.state)
  const [reset, { isLoading, error }] = useResetPasswordMutation()
  const [values, setValues] = useState<ResetValues>({
    email: stateEmail ?? '',
    code: '',
    newPassword: '',
  })
  const [submitted, setSubmitted] = useState(false)

  const clientErrors = submitted ? validateReset(values) : {}
  const backendCode = getErrorCode(error)
  const serverFields = getFieldErrors(error)
  const codeError =
    clientErrors.code ??
    (backendCode === 'CODE_INVALID' ? getErrorMessage(error) : serverFields.code)
  const suspended = backendCode === 'ACCOUNT_SUSPENDED'
  // CODE_INVALID sta sotto le caselle e la sospensione ha la sua scheda: gli altri errori vanno nell'avviso in alto
  const alertError = backendCode === 'CODE_INVALID' || suspended ? null : error
  const emailError = clientErrors.email ?? serverFields.email

  const set = (field: keyof ResetValues) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateReset(values)).length > 0) return
    try {
      await reset({
        email: values.email.trim(),
        code: values.code,
        newPassword: values.newPassword,
      }).unwrap()
      navigate(ROUTES.login, { state: { passwordChanged: true } })
    } catch {
      // L'errore lo mostra la pagina, dallo stato della mutazione
    }
  }

  return (
    <>
      {suspended && <SuspendedNotice details={suspensionOf((error as { data: unknown }).data)} />}
      <AuthCard title="Scegli una nuova password">
        {codeSent && (
          <Alert variant="info">
            Se l'indirizzo è registrato e verificato, ti abbiamo inviato un codice.
          </Alert>
        )}
        <p className="text-body-secondary">
          Scrivi il codice a 6 cifre che ti abbiamo inviato e scegli una nuova password.
        </p>
        <ErrorAlert error={alertError} />
        <Form noValidate onSubmit={(event) => void handleSubmit(event)}>
          <Form.Group className="mb-4">
            <Form.Label htmlFor="reset-email" className="rs-required">
              Email
            </Form.Label>
            <Form.Control
              id="reset-email"
              type="email"
              value={values.email}
              autoComplete="email"
              placeholder="tuonome@dominio.it"
              isInvalid={Boolean(emailError)}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? 'reset-email-error' : undefined}
              onChange={(event) => set('email')(event.target.value)}
            />
            <FieldError id="reset-email-error" message={emailError} />
          </Form.Group>
          <OtpField value={values.code} onChange={set('code')} error={codeError} />
          <PasswordField
            label="Nuova password"
            value={values.newPassword}
            onChange={set('newPassword')}
            autoComplete="new-password"
            error={clientErrors.newPassword ?? serverFields.newPassword}
            showByteCount
          />
          <DesktopMagnet fullWidth>
            <Button
              type="submit"
              variant="primary"
              className="rs-auth-submit w-100"
              disabled={isLoading}
            >
              <span className="rs-auth-submit__label">Cambia password</span>
            </Button>
          </DesktopMagnet>
        </Form>
        <ResendCode email={values.email} initiallyWaiting={Boolean(codeSent)} purpose="reset" />
      </AuthCard>
    </>
  )
}

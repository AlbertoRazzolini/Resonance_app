import { useState, type FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router'
import { ROUTES } from '@/app/routes'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { FieldError } from '@/components/ui/FieldError'
import { useForgotPasswordMutation } from '../api/authApi'
import { AuthCard } from '../components/AuthCard'
import { validateForgot } from '../validation'

/**
 * Password dimenticata (progettazione, sezione 4.10; decisione 51). La risposta del backend è sempre 204, che l'email
 * esista o no: la pagina non dice mai se l'account c'è. A invio riuscito si passa al reset con l'email già scritta e
 * il segno che il codice è appena partito, che lì mostra l'avviso neutro.
 */
export function Component() {
  const navigate = useNavigate()
  const [forgot, { isLoading, error }] = useForgotPasswordMutation()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const emailError = submitted ? validateForgot({ email }).email : undefined

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (validateForgot({ email }).email) return
    const trimmed = email.trim()
    try {
      await forgot({ email: trimmed }).unwrap()
      navigate(ROUTES.resetPassword, { state: { email: trimmed, codeSent: true } })
    } catch {
      // L'errore lo mostra la pagina, dallo stato della mutazione
    }
  }

  return (
    <AuthCard
      title="Password dimenticata"
      aside={
        <>
          Hai già un codice? <Link to={ROUTES.resetPassword}>Inseriscilo</Link>
        </>
      }
    >
      <p className="text-body-secondary">
        Ti verrà mandato un codice a 6 cifre per il ripristino password.
      </p>
      <ErrorAlert error={error} />
      <Form noValidate onSubmit={(event) => void handleSubmit(event)}>
        <Form.Group className="mb-4">
          <Form.Label htmlFor="forgot-email" className="rs-required">
            Email
          </Form.Label>
          <Form.Control
            id="forgot-email"
            type="email"
            value={email}
            autoComplete="email"
            placeholder="tuonome@dominio.it"
            isInvalid={Boolean(emailError)}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? 'forgot-email-error' : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
          <FieldError id="forgot-email-error" message={emailError} />
        </Form.Group>
        <Button
          type="submit"
          variant="primary"
          className="rs-auth-submit w-100"
          disabled={isLoading}
        >
          <span className="rs-auth-submit__label">Invia il codice</span>
        </Button>
      </Form>
    </AuthCard>
  )
}

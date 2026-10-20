import { useEffect, useState } from 'react'
import { Button } from 'react-bootstrap'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { getErrorCode } from '@/lib/errors/getErrorMessage'
import { useForgotPasswordMutation, useResendCodeMutation } from '../api/authApi'
import { emailError } from '../validation'

/** Attesa fra due reinvii: il backend ne accetta uno ogni 60 secondi (progettazione, sezione 4.6). */
const WAIT_SECONDS = 60

const LABEL = 'Invia di nuovo il codice'

/** Per cosa si rimanda il codice: la verifica dell'email o il reset della password (stesso limite, stesso comportamento). */
export type ResendPurpose = 'verification' | 'reset'

/** Messaggio dopo il reinvio: il backend risponde sempre 204, quindi non promette che il codice parta (decisione 51). */
const SENT_MESSAGE: Record<ResendPurpose, string> = {
  verification:
    "Se l'indirizzo è in attesa di verifica, il codice sta arrivando. Non puoi chiederne un altro subito: controlla se ti è arrivato, anche nella cartella spam.",
  reset:
    "Se l'indirizzo è registrato e verificato, il codice sta arrivando. Non puoi chiederne un altro subito: controlla se ti è arrivato, anche nella cartella spam.",
}

/**
 * Reinvio del codice con l'attesa visibile (riuso adattato di `ReinvioCodice` di NoseY): il pulsante mostra i secondi
 * che mancano. Con `initiallyWaiting` (si arriva dalla registrazione, il codice è appena partito) l'attesa parte
 * subito. Con `purpose="reset"` rimanda il codice di reset (stesso endpoint di "password dimenticata").
 */
export function ResendCode({
  email,
  initiallyWaiting,
  purpose = 'verification',
}: {
  email: string
  initiallyWaiting: boolean
  purpose?: ResendPurpose
}) {
  // Due mutazioni, una sola in uso: gli hook non si chiamano in modo condizionale
  const verification = useResendCodeMutation()
  const reset = useForgotPasswordMutation()
  const [resend, { isLoading, error }] = purpose === 'reset' ? reset : verification
  const [waitUntil, setWaitUntil] = useState(() =>
    initiallyWaiting ? Date.now() + WAIT_SECONDS * 1000 : 0,
  )
  const [now, setNow] = useState(() => Date.now())
  const [sent, setSent] = useState(false)

  const remaining = Math.max(0, Math.ceil((waitUntil - now) / 1000))
  const waiting = remaining > 0

  // Un aggiornamento al secondo, solo finché si aspetta
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [waiting])

  function startWaiting() {
    const current = Date.now()
    setNow(current)
    setWaitUntil(current + WAIT_SECONDS * 1000)
  }

  async function handleClick() {
    setSent(false)
    try {
      await resend({ email: email.trim() }).unwrap()
      startWaiting()
      setSent(true)
    } catch (caught) {
      // Troppe richieste: il backend ha già un invio recente, quindi si aspetta come dopo un invio riuscito
      if (getErrorCode(caught) === 'TOO_MANY_REQUESTS') startWaiting()
    }
  }

  return (
    <div>
      <ErrorAlert error={error} />
      {sent && waiting && (
        <p className="rs-field-hint text-center" role="status">
          {SENT_MESSAGE[purpose]}
        </p>
      )}
      <Button
        type="button"
        variant="link"
        className="rs-resend"
        disabled={waiting || isLoading || Boolean(emailError(email))}
        onClick={() => void handleClick()}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
          <path d="M15 1H9v2h6V1Zm-4 13h2V8h-2v6Zm8.03-6.61 1.42-1.42a10.4 10.4 0 0 0-1.41-1.41l-1.42 1.42A8.96 8.96 0 0 0 12 4a9 9 0 1 0 9 9c0-2.12-.74-4.07-1.97-5.61ZM12 20a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
        </svg>
        {waiting ? `${LABEL} (${remaining} s)` : LABEL}
      </Button>
    </div>
  )
}

import { Alert } from 'react-bootstrap'
import { DISPLAY_NAME_TAKEN, getErrorCode, getErrorMessage } from '@/lib/errors/getErrorMessage'

/**
 * Avviso rosso con il messaggio italiano dell'errore (RTK Query o eccezione); senza errore non disegna nulla. Il nome
 * utente già in uso non compare qui: è un errore del campo e lo scrive il form sotto il nome (decisione 96).
 */
export function ErrorAlert({ error }: { error: unknown }) {
  if (!error || getErrorCode(error) === DISPLAY_NAME_TAKEN) return null
  return (
    <Alert variant="danger" role="alert">
      {getErrorMessage(error)}
    </Alert>
  )
}

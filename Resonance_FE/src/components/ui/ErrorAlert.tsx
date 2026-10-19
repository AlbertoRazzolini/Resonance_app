import { Alert } from 'react-bootstrap'
import { getErrorMessage } from '@/lib/errors/getErrorMessage'

/** Avviso rosso con il messaggio italiano dell'errore (RTK Query o eccezione); senza errore non disegna nulla. */
export function ErrorAlert({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <Alert variant="danger" role="alert">
      {getErrorMessage(error)}
    </Alert>
  )
}

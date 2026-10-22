import { useEffect } from 'react'
import { Alert } from 'react-bootstrap'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import {
  confirmationDismissed,
  selectConfirmation,
} from '@/lib/notices/confirmationSlice'

/** Quanto resta visibile la conferma prima di sparire da sola (scelta dello studente, FE-09a). */
const VISIBLE_MS = 4000

/**
 * Striscia di conferma in cima alla pagina: dice che un'azione è andata a buon fine, sparisce dopo 4 secondi e si può
 * chiudere. È una regione `status`, così i lettori di schermo la leggono senza togliere il fuoco. Gli avvisi di sistema
 * restano a `NoticeBar`.
 */
export function ConfirmationBar() {
  const { text, seq } = useAppSelector(selectConfirmation)
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (text === null) return
    const timer = setTimeout(() => dispatch(confirmationDismissed()), VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [text, seq, dispatch])

  if (text === null) return null

  return (
    <Alert
      variant="success"
      role="status"
      dismissible
      closeLabel="Chiudi"
      onClose={() => dispatch(confirmationDismissed())}
      className="rs-confirmation"
    >
      {text}
    </Alert>
  )
}

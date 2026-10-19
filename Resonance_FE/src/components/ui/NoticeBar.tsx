import { useState } from 'react'
import { Alert, Button } from 'react-bootstrap'
import { useAppDispatch, useAppSelector, useAppStore } from '@/hooks/redux'
import { refreshSession } from '@/lib/api/apiSlice'
import { noticeDismissed, selectNotice, type NoticeKind } from '@/lib/notices/noticeSlice'

/** Testi degli avvisi di sistema (approvati dallo studente il 19 ottobre). */
const NOTICE_TEXT: Record<NoticeKind, string> = {
  serverUnreachable:
    'Non riesco a contattare il server: la tua sessione potrebbe essere ancora attiva.',
  logoutIncomplete:
    'Sei uscito da questo dispositivo, ma il server non ha risposto: la sessione potrebbe riaprirsi al prossimo caricamento. Riprova a uscire quando la rete torna.',
}

/**
 * Barra degli avvisi di sistema in cima all'app. Per `serverUnreachable` ha il pulsante Riprova, che rifà il
 * rinnovo della sessione: se il server risponde (sessione ripresa o davvero scaduta) l'avviso sparisce.
 */
export function NoticeBar() {
  const notice = useAppSelector(selectNotice)
  const dispatch = useAppDispatch()
  const store = useAppStore()
  const [retrying, setRetrying] = useState(false)

  if (!notice) return null

  async function retry() {
    setRetrying(true)
    const outcome = await refreshSession(store)
    setRetrying(false)
    if (outcome !== 'failed') dispatch(noticeDismissed())
  }

  return (
    <Alert
      variant="warning"
      dismissible
      closeLabel="Chiudi"
      onClose={() => dispatch(noticeDismissed())}
      className="d-flex flex-wrap align-items-center gap-2"
    >
      <span>{NOTICE_TEXT[notice]}</span>
      {notice === 'serverUnreachable' && (
        <Button size="sm" variant="outline-dark" disabled={retrying} onClick={() => void retry()}>
          Riprova
        </Button>
      )}
    </Alert>
  )
}

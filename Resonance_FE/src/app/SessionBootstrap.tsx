import { useEffect, type ReactNode } from 'react'
import { sessionEnded } from '@/features/auth/authSlice'
import { useAppSelector, useAppStore } from '@/hooks/redux'
import { refreshSession } from '@/lib/api/apiSlice'
import { useTokenRenewal } from '@/lib/api/useTokenRenewal'
import { noticeShown } from '@/lib/notices/noticeSlice'
import { HydrateFallback } from './HydrateFallback'

/**
 * Avvio della sessione (progettazione, sezione 4.13): all'apertura un refresh con il cookie. Finché non
 * risponde mostra il caricamento e non monta l'app, così l'utente non vede mai l'interfaccia anonima per un
 * istante. Poi lo stato è `authenticated` o `anonymous`. Tiene anche attivo il rinnovo anticipato del token.
 */
export function SessionBootstrap({ children }: { children: ReactNode }) {
  const store = useAppStore()
  const status = useAppSelector((state) => state.auth.status)
  useTokenRenewal()

  useEffect(() => {
    // StrictMode lancia l'effetto due volte: il secondo refresh si unisce al primo (una sola promessa)
    void refreshSession(store).then((outcome) => {
      // Server non raggiungibile all'avvio: si prosegue da anonimi (le pagine pubbliche funzionano) con un
      // avviso e il pulsante Riprova, perché la sessione potrebbe essere ancora valida
      if (outcome === 'failed') {
        store.dispatch(sessionEnded())
        store.dispatch(noticeShown('serverUnreachable'))
      }
    })
  }, [store])

  return status === 'unknown' ? <HydrateFallback /> : children
}

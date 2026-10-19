import { useEffect } from 'react'
import { useAppSelector, useAppStore } from '@/hooks/redux'
import { refreshSession } from './apiSlice'

/** Anticipo del rinnovo rispetto alla scadenza dell'access token (progettazione, sezione 4.13). */
const RENEWAL_ADVANCE_MS = 60_000

/** Attesa prima del secondo tentativo, se il primo rinnovo fallisce per un errore passeggero: il token vale ancora circa 45 s. */
const RENEWAL_RETRY_DELAY_MS = 15_000

/**
 * Rinnova l'access token 60 s prima di `accessTokenExpiresAt`, così una richiesta non incontra mai un token
 * scaduto (e il SEND STOMP dopo un periodo di inattività non riceve `TOKEN_INVALID`). Se il rinnovo fallisce per un
 * errore passeggero ritenta una volta dopo 15 s. Dopo ogni rinnovo la scadenza cambia e il timer si riprogramma da solo.
 */
export function useTokenRenewal() {
  const store = useAppStore()
  const expiresAt = useAppSelector((state) => state.auth.accessTokenExpiresAt)

  useEffect(() => {
    if (!expiresAt) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    async function renew(retriesLeft: number) {
      const outcome = await refreshSession(store)
      if (outcome === 'failed' && retriesLeft > 0 && !cancelled) {
        timer = setTimeout(() => void renew(retriesLeft - 1), RENEWAL_RETRY_DELAY_MS)
      }
    }

    const delay = Math.max(0, Date.parse(expiresAt) - RENEWAL_ADVANCE_MS - Date.now())
    timer = setTimeout(() => void renew(1), delay)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [expiresAt, store])
}

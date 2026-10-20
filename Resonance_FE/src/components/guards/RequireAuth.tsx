import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { ROUTES } from '@/app/routes'
import { useAppSelector } from '@/hooks/redux'

/**
 * Stato di navigazione verso il login: la pagina richiesta, a cui la pagina di accesso riporta dopo l'accesso, e il
 * segno `loginRequired` che fa dire alla pagina di accesso che serve l'accesso (solo se si arriva da qui).
 */
export type LoginRedirectState = { from?: string; loginRequired?: true }

/**
 * Mostra i figli solo a chi ha una sessione; gli altri vanno al login, che ricorda la pagina richiesta nello
 * stato del router (non nell'URL: nessun parametro modificabile da altri, quindi nessun reindirizzamento aperto).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAppSelector((state) => state.auth.status)
  const { pathname, search, hash } = useLocation()

  // `unknown` non si vede qui: SessionBootstrap non monta l'app finché l'avvio non ha deciso
  if (status === 'unknown') return null
  if (status === 'anonymous') {
    const state: LoginRedirectState = { from: pathname + search + hash, loginRequired: true }
    return <Navigate to={ROUTES.login} replace state={state} />
  }
  return children
}

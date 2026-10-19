import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { ROUTES } from '@/app/routes'
import { readAuthState } from '@/features/auth/locationState'
import { useAppSelector } from '@/hooks/redux'

/**
 * Le pagine di accesso non servono a chi ha già la sessione: va alla pagina richiesta (se la strada è partita da lì,
 * ad esempio subito dopo il login) oppure alla home. Il percorso richiesto passa da `readAuthState`, che scarta
 * tutto ciò che non è interno all'app.
 */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const status = useAppSelector((state) => state.auth.status)
  const location = useLocation()

  if (status === 'authenticated') {
    return <Navigate to={readAuthState(location.state).from ?? ROUTES.home} replace />
  }
  return children
}

import type { ReactNode } from 'react'
import { selectHasRole } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import type { Role } from '@/types/users'
import { AccessDenied } from '@/components/ui/AccessDenied'
import { RequireAuth } from './RequireAuth'

/**
 * Mostra i figli a chi ha almeno uno dei ruoli indicati; gli altri vedono "Accesso negato" allo stesso indirizzo,
 * gli anonimi vanno al login. Solo interfaccia: i ruoli di `MeResponse` servono a mostrare o nascondere, il
 * controllo vero è nel backend.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const allowed = useAppSelector((state) => roles.some((role) => selectHasRole(role)(state)))
  return <RequireAuth>{allowed ? children : <AccessDenied />}</RequireAuth>
}

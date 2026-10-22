import type { Role } from '@/types/users'

/** Chi agisce, o il bersaglio: basta l'id e i ruoli. */
type Actor = { id: string; roles: readonly Role[] }

/**
 * Livello di piattaforma (progettazione, sezione 5.6): SUPERADMIN 2, ADMIN 1, solo ruoli di community 0. Specchia
 * `PlatformLevelPolicy` del backend per decidere cosa mostrare; il controllo vero resta nel backend (403
 * `INSUFFICIENT_PLATFORM_LEVEL`).
 */
export function platformLevel(roles: readonly Role[]): 0 | 1 | 2 {
  if (roles.includes('SUPERADMIN')) return 2
  if (roles.includes('ADMIN')) return 1
  return 0
}

/** Si può agire sul bersaglio solo se non è se stessi e ha un livello inferiore (sezione 5.6). */
export function canActOn(actor: Actor, target: Actor): boolean {
  return actor.id !== target.id && platformLevel(target.roles) < platformLevel(actor.roles)
}

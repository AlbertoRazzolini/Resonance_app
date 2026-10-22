import type { SuspendUserRequest } from '@/types/admin'

/** Lunghezza massima del motivo (progettazione, sezione 5.5). */
export const REASON_MAX = 500

/**
 * Durate fisse offerte all'admin, in giorni. Oltre l'ultima c'è solo «Indeterminata»: una sospensione più lunga di tre
 * mesi non si distingue da quella senza scadenza, che si chiude comunque con «Riattiva» (scelta dello studente, FE-10;
 * il backend accetta fino a 3650 giorni, il limite è solo dell'interfaccia).
 */
export const SUSPENSION_DAYS = [1, 3, 7, 30, 90] as const

/** Durata scelta: un numero di giorni, `'indefinite'` o niente (il form parte senza scelta). */
export type SuspensionDuration = number | 'indefinite' | null

export type SuspensionValues = { reason: string; duration: SuspensionDuration }

/** Il motivo è 1–500 caratteri senza gli spazi ai bordi, e una durata deve essere stata scelta. */
export function isSuspensionValid({ reason, duration }: SuspensionValues): boolean {
  const trimmed = reason.trim()
  return trimmed.length >= 1 && trimmed.length <= REASON_MAX && duration !== null
}

/** Corpo di `POST /api/admin/users/{id}/suspension`: solo i giorni scelti, o niente per l'indeterminata (sezione 5.5). */
export function buildSuspendRequest({ reason, duration }: SuspensionValues): SuspendUserRequest {
  const request: SuspendUserRequest = { reason: reason.trim() }
  if (typeof duration === 'number') request.durationDays = duration
  return request
}

// Tipi di utente e sessione, dal codice dei DTO del backend (progettazione, sezioni 4.1 e 6.4).

export type Role = 'FAN' | 'MUSICIAN' | 'HOST' | 'ADMIN' | 'SUPERADMIN'

export type UserStatus = 'ACTIVE' | 'SUSPENDED'

/** Profilo dell'utente autenticato; le date sono stringhe ISO-8601 in UTC. */
export type MeResponse = {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  roles: Role[]
  status: UserStatus
  createdAt: string
}

/** Risposta di verify, login e refresh: il refresh token non è nel body, viaggia nel cookie. */
export type LoginResponse = {
  accessToken: string
  accessTokenExpiresAt: string
  user: MeResponse
}

/** Dettagli di `ACCOUNT_SUSPENDED` (`ErrorResponse.details`); `suspendedUntil` nullo = a tempo indeterminato. */
export type SuspensionDetails = {
  suspensionReason: string
  suspendedUntil: string | null
}

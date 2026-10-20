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

/** Nome da mostrare per ogni ruolo (badge del profilo); il CSS dei badge li scrive in maiuscolo. */
export const ROLE_LABELS: Record<Role, string> = {
  FAN: 'Fan',
  MUSICIAN: 'Musicista',
  HOST: 'Host',
  ADMIN: 'Admin',
  SUPERADMIN: 'Superadmin',
}

/**
 * Corpo di `PATCH /api/users/me` (progettazione, sezione 6.5): un campo assente è invariato, una stringa vuota
 * svuota `bio`, `city` e `avatarUrl`; `latitude` e `longitude` vanno sempre insieme.
 */
export type UpdateProfileRequest = {
  displayName?: string
  avatarUrl?: string
  bio?: string
  city?: string
  latitude?: number
  longitude?: number
}

/** Profilo pubblico di `GET /api/users/{id}`: mai email né coordinate, e solo i ruoli della community. */
export type PublicUserResponse = {
  id: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
  city: string | null
  roles: Role[]
}

/** Corpo di `POST /api/auth/register`. */
export type RegisterRequest = {
  email: string
  password: string
  displayName: string
}

/** Risposta di `POST /api/auth/register`: solo l'email, senza l'id (progettazione, sezione 4.4). */
export type RegisterResponse = {
  email: string
}

/** Corpo di `POST /api/auth/verify`: l'email, il codice a 6 cifre e la password scelta alla registrazione. */
export type VerifyRequest = {
  email: string
  code: string
  password: string
}

/** Corpo di `POST /api/auth/resend-code`. */
export type ResendCodeRequest = {
  email: string
}

/** Corpo di `POST /api/auth/password/forgot`. */
export type ForgotPasswordRequest = {
  email: string
}

/** Corpo di `POST /api/auth/password/reset`: l'email, il codice a 6 cifre e la nuova password. */
export type ResetPasswordRequest = {
  email: string
  code: string
  newPassword: string
}

/** Corpo di `POST /api/auth/login`. */
export type LoginRequest = {
  email: string
  password: string
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

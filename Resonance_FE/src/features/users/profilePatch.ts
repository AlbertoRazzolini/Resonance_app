import { displayNameError } from '@/features/auth/validation'
import type { MeResponse, UpdateProfileRequest } from '@/types/users'

// Logica pura del form del profilo (progettazione, sezione 6.5; decisioni 30 e 31): valori di partenza, PATCH con i
// soli campi cambiati, controlli come quelli del backend e coordinate della posizione.

export const BIO_MAX = 500
export const CITY_MAX = 100
export const AVATAR_URL_MAX = 2048

/** Valori del form: sempre stringhe, il campo vuoto è la stringa vuota (nel backend `null`). */
export type ProfileValues = {
  displayName: string
  bio: string
  city: string
  avatarUrl: string
}

export type ProfileErrors = Partial<Record<keyof ProfileValues, string>>

/** Valori di partenza del form, presi dal profilo salvato. */
export const profileValues = (user: MeResponse): ProfileValues => ({
  displayName: user.displayName,
  bio: user.bio ?? '',
  city: user.city ?? '',
  avatarUrl: user.avatarUrl ?? '',
})

/**
 * Solo i campi cambiati, dopo il trim. Una stringa vuota svuota `bio`, `city` e `avatarUrl` (decisione 31); il nome
 * non si invia mai vuoto, perché non si può svuotare.
 */
export function buildProfilePatch(values: ProfileValues, saved: ProfileValues): UpdateProfileRequest {
  const patch: UpdateProfileRequest = {}
  const displayName = values.displayName.trim()
  if (displayName && displayName !== saved.displayName) patch.displayName = displayName
  for (const field of ['bio', 'city', 'avatarUrl'] as const) {
    const value = values[field].trim()
    if (value !== saved[field]) patch[field] = value
  }
  return patch
}

/** Solo indirizzi `http` o `https`: niente `javascript:`, `data:` né indirizzi senza protocollo. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** Un errore per ogni campo sbagliato, con le regole del backend (i campi si contano dopo il trim). */
export function validateProfile(values: ProfileValues): ProfileErrors {
  const errors: ProfileErrors = {}
  const displayName = displayNameError(values.displayName)
  if (displayName) errors.displayName = displayName
  if (values.bio.trim().length > BIO_MAX) {
    errors.bio = `La bio può avere al massimo ${BIO_MAX} caratteri.`
  }
  if (values.city.trim().length > CITY_MAX) {
    errors.city = `La città può avere al massimo ${CITY_MAX} caratteri.`
  }
  const avatarUrl = values.avatarUrl.trim()
  if (avatarUrl.length > AVATAR_URL_MAX) {
    errors.avatarUrl = `L'indirizzo può avere al massimo ${AVATAR_URL_MAX} caratteri.`
  } else if (avatarUrl && !isHttpUrl(avatarUrl)) {
    errors.avatarUrl = 'Scrivi un indirizzo che inizia con http:// o https://.'
  }
  return errors
}

/** Stato di navigazione verso `/profilo` dopo un salvataggio: serve all'avviso «Profilo aggiornato.» (non è nell'URL). */
export type ProfileLocationState = { profileUpdated?: true }

/** Legge lo stato di navigazione ignorando tutto ciò che non è il segno del salvataggio. */
export function wasProfileUpdated(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as ProfileLocationState).profileUpdated === true
  )
}

/** Posizione del browser, in gradi. */
export type Coordinates = { latitude: number; longitude: number }

/** Due decimali sono circa 1 km: basta per cercare eventi a 5-100 km e non salva la posizione esatta (decisione 30). */
const roundCoordinate = (value: number) => Math.round(value * 100) / 100

/** PATCH della posizione: latitudine e longitudine insieme (una sola dà 400), arrotondate. */
export function buildLocationPatch(position: Coordinates): UpdateProfileRequest {
  return {
    latitude: roundCoordinate(position.latitude),
    longitude: roundCoordinate(position.longitude),
  }
}

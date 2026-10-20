// Controlli del form di registrazione, con le stesse regole del backend (progettazione, sezioni 4.4 e 6.4; decisione 84).
// Il backend resta l'unico a decidere davvero: qui si evita solo un viaggio al server per errori che si vedono subito.

export const DISPLAY_NAME_MIN = 3
export const DISPLAY_NAME_MAX = 30
export const EMAIL_MAX = 255
export const PASSWORD_MIN = 8
/** Limite in caratteri e in byte UTF-8: BCrypt legge al massimo 72 byte (progettazione, sezione 4.4). */
export const PASSWORD_MAX = 72

export type RegisterValues = {
  displayName: string
  email: string
  password: string
}

export type RegisterErrors = Partial<Record<keyof RegisterValues, string>>

const encoder = new TextEncoder()

/** Lunghezza in byte UTF-8, come la conta il backend (una lettera accentata ne vale 2). */
export function byteLength(text: string): number {
  return encoder.encode(text).length
}

// Come `NoEmojiValidator` del backend: emoji grafiche, modificatori, bandiere, selettore U+FE0F e collante ZWJ.
// Cifre, # e * non contano (sono emoji solo come base di una sequenza, riconosciuta dal selettore).
const EMOJI =
  /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\uFE0F|\u200D/u

// Come `NoInvisibleCharsValidator`: controllo (Cc), formato (Cf), separatori di riga (Zl) e di paragrafo (Zp).
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u

// Formato semplice ma sufficiente (qualcosa@qualcosa.dominio): il controllo vero lo fa il backend
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Nome visibile: il backend lo valida dopo il trim e lo conta in caratteri (unità UTF-16, come `@Size`). */
function displayNameError(raw: string): string | undefined {
  const name = raw.trim()
  if (!name) return 'Scrivi il nome visibile.'
  if (EMOJI.test(name)) return 'Le emoji non sono ammesse nel nome.'
  if (INVISIBLE.test(name)) return 'Il nome non può contenere caratteri invisibili.'
  if (name.length < DISPLAY_NAME_MIN || name.length > DISPLAY_NAME_MAX) {
    return `Il nome deve avere da ${DISPLAY_NAME_MIN} a ${DISPLAY_NAME_MAX} caratteri.`
  }
  return undefined
}

/** Email: vuota, non valida o troppo lunga (dopo il trim, come fa il backend). */
export function emailError(raw: string): string | undefined {
  const email = raw.trim()
  if (!email) return 'Scrivi la tua email.'
  if (!EMAIL.test(email)) return 'Scrivi un indirizzo email valido.'
  if (email.length > EMAIL_MAX) return `L'email può avere al massimo ${EMAIL_MAX} caratteri.`
  return undefined
}

/** Password: non si toglie nessuno spazio (ne fanno parte), ma una password di soli spazi vale come vuota. */
function passwordError(password: string): string | undefined {
  if (!password.trim()) return 'Scrivi la password.'
  if (EMOJI.test(password)) return 'Le emoji non sono ammesse nella password.'
  if (password.length < PASSWORD_MIN)
    return `La password deve avere almeno ${PASSWORD_MIN} caratteri.`
  if (password.length > PASSWORD_MAX || byteLength(password) > PASSWORD_MAX) {
    return `La password è troppo lunga: al massimo ${PASSWORD_MAX} byte (le lettere accentate ne occupano di più).`
  }
  return undefined
}

/** Un errore per ogni campo sbagliato, il primo che non va (vuoto, emoji, caratteri invisibili, lunghezza). */
export function validateRegister(values: RegisterValues): RegisterErrors {
  const errors: RegisterErrors = {}
  const displayName = displayNameError(values.displayName)
  const email = emailError(values.email)
  const password = passwordError(values.password)
  if (displayName) errors.displayName = displayName
  if (email) errors.email = email
  if (password) errors.password = password
  return errors
}

export type VerifyValues = {
  email: string
  code: string
  password: string
}

export type VerifyErrors = Partial<Record<keyof VerifyValues, string>>

/**
 * Controlli del form di verifica (progettazione, sezione 4.5): email come nella registrazione, codice di esattamente 6
 * cifre, password presente. Alla password non si applicano le regole di una nuova password: se non è quella della
 * registrazione risponde il backend (`WRONG_PASSWORD`).
 */
export function validateVerify(values: VerifyValues): VerifyErrors {
  const errors: VerifyErrors = {}
  const email = emailError(values.email)
  if (email) errors.email = email
  if (!/^\d{6}$/.test(values.code)) errors.code = 'Scrivi le 6 cifre del codice.'
  if (!values.password.trim()) errors.password = 'Scrivi la password.'
  return errors
}

export type ForgotValues = {
  email: string
}

export type ForgotErrors = Partial<Record<keyof ForgotValues, string>>

/** Controllo del form "password dimenticata": solo l'email, scritta bene. */
export function validateForgot(values: ForgotValues): ForgotErrors {
  const email = emailError(values.email)
  return email ? { email } : {}
}

export type ResetValues = {
  email: string
  code: string
  newPassword: string
}

export type ResetErrors = Partial<Record<keyof ResetValues, string>>

/**
 * Controlli del form di reset (progettazione, sezione 4.10): email come nella registrazione, codice di 6 cifre e nuova
 * password con le stesse regole di una password nuova (decisione 84).
 */
export function validateReset(values: ResetValues): ResetErrors {
  const errors: ResetErrors = {}
  const email = emailError(values.email)
  const newPassword = passwordError(values.newPassword)
  if (email) errors.email = email
  if (!/^\d{6}$/.test(values.code)) errors.code = 'Scrivi le 6 cifre del codice.'
  if (newPassword) errors.newPassword = newPassword
  return errors
}

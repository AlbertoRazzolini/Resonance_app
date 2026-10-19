/**
 * Cosa le pagine di accesso si passano nello stato del router (non nell'URL: nessun parametro modificabile da altri,
 * decisione 82): la pagina richiesta, l'email già scritta e l'avviso dopo il reset della password.
 */
export type AuthLocationState = {
  from?: string
  email?: string
  passwordChanged?: boolean
}

/** Solo percorsi interni: niente indirizzi assoluti, né `//sito` né barre rovesciate (nessun reindirizzamento aperto). */
function isInternalPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
}

/** Legge lo stato di navigazione ignorando i campi che mancano, hanno il tipo sbagliato o non sono percorsi interni. */
export function readAuthState(state: unknown): AuthLocationState {
  if (typeof state !== 'object' || state === null) return {}
  const { from, email, passwordChanged } = state as Record<string, unknown>
  const result: AuthLocationState = {}
  if (typeof from === 'string' && isInternalPath(from)) result.from = from
  if (typeof email === 'string') result.email = email
  if (passwordChanged === true) result.passwordChanged = true
  return result
}

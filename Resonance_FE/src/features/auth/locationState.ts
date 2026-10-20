/**
 * Cosa le pagine di accesso si passano nello stato del router (non nell'URL: nessun parametro modificabile da altri,
 * decisione 82): la pagina richiesta, l'email già scritta, il segno che il codice è appena partito (la verifica
 * aspetta 60 secondi prima di permettere un reinvio), l'avviso dopo il reset della password e il segno che si arriva da
 * una pagina protetta (`RequireAuth`), per dire che serve l'accesso.
 */
export type AuthLocationState = {
  from?: string
  email?: string
  codeSent?: boolean
  passwordChanged?: boolean
  loginRequired?: boolean
}

/** Solo percorsi interni: niente indirizzi assoluti, né `//sito` né barre rovesciate (nessun reindirizzamento aperto). */
function isInternalPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
}

/** Legge lo stato di navigazione ignorando i campi che mancano, hanno il tipo sbagliato o non sono percorsi interni. */
export function readAuthState(state: unknown): AuthLocationState {
  if (typeof state !== 'object' || state === null) return {}
  const { from, email, codeSent, passwordChanged, loginRequired } = state as Record<string, unknown>
  const result: AuthLocationState = {}
  if (typeof from === 'string' && isInternalPath(from)) result.from = from
  if (typeof email === 'string') result.email = email
  if (codeSent === true) result.codeSent = true
  if (passwordChanged === true) result.passwordChanged = true
  if (loginRequired === true) result.loginRequired = true
  return result
}

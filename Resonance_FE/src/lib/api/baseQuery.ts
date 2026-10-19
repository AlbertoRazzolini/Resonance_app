import {
  fetchBaseQuery,
  type BaseQueryApi,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query'
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit'
import type { AuthState } from '@/features/auth/authSlice'
import type { ErrorResponse } from '@/types/common'

/**
 * Base degli URL: l'origine della pagina. Il browser vede una sola origine (proxy di Vite in sviluppo,
 * stesso servizio su Render: progettazione, sezione 4.3), quindi equivale a un URL relativo; serve
 * assoluta perché `fetch` di Node (test) non accetta URL relativi.
 */
const API_BASE = window.location.origin

/** Header richiesto dal backend su refresh e logout contro il CSRF (progettazione, sezione 8.5). */
export const CSRF_HEADERS = { 'X-Requested-With': 'XMLHttpRequest' }

/** Le parti dello store che servono qui: tipo minimo, per non rendere circolare il tipo dello store. */
type WithAuth = { auth: AuthState }

/** `dispatch` e `getState` dello store: li hanno sia il baseQuery sia i componenti. */
export type SessionApi = {
  dispatch: ThunkDispatch<unknown, unknown, UnknownAction>
  getState: () => unknown
}

/**
 * Esito di un refresh: `refreshed` token nuovo; `ended` rifiuto definitivo, sessione chiusa; `failed`
 * errore passeggero (rete, 5xx, doppio 409), sessione lasciata com'è.
 */
export type RefreshOutcome = 'refreshed' | 'ended' | 'failed'

const authOf = (api: Pick<SessionApi, 'getState'>) => (api.getState() as WithAuth).auth

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE,
  credentials: 'include',
  // Bearer su ogni richiesta, anche sugli endpoint pubblici: con il token il backend personalizza la risposta.
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as WithAuth).auth.accessToken
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

/** Codice di un `ErrorResponse` (nel corpo di una risposta d'errore), se c'è. */
export function errorCode(body: unknown): string | undefined {
  return typeof body === 'object' && body !== null
    ? (body as Partial<ErrorResponse>).code
    : undefined
}

/** Gli endpoint di auth non attivano mai il refresh: il loro 401 è un esito (credenziali sbagliate), non un token scaduto. */
const isAuthEndpoint = (args: string | FetchArgs) =>
  (typeof args === 'string' ? args : args.url).startsWith('/api/auth/')

const isUnauthenticated = (error: FetchBaseQueryError | undefined) =>
  error?.status === 401 && errorCode(error.data) === 'UNAUTHENTICATED'

/** Errore di una richiesta che non ha potuto rinnovare la sessione per un problema passeggero: dice "server non raggiungibile". */
const REFRESH_FAILED_ERROR: FetchBaseQueryError = {
  status: 'FETCH_ERROR',
  error: 'Rinnovo della sessione non riuscito',
}

/**
 * Crea il baseQuery con Bearer dallo store e refresh silenzioso: su 401 `UNAUTHENTICATED` di un endpoint
 * protetto rinnova il token (una sola volta per tutte le richieste in attesa) e ripete la richiesta
 * (progettazione, sezione 4.13). `refresh` lo passa `apiSlice`, che ha l'endpoint: così questo file non
 * dipende dall'`api` e non nascono import circolari.
 */
export function createBaseQueryWithReauth(
  refresh: (api: BaseQueryApi) => Promise<RefreshOutcome>,
): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> {
  return async (args, api, extraOptions) => {
    const tokenSent = authOf(api).accessToken
    const result = await rawBaseQuery(args, api, extraOptions)
    if (
      !isUnauthenticated(result.error) ||
      isAuthEndpoint(args) ||
      authOf(api).status !== 'authenticated'
    ) {
      return result
    }
    // Se un'altra richiesta ha già rinnovato il token mentre questa era in volo, basta ripetere
    if (authOf(api).accessToken === tokenSent) {
      const outcome = await refresh(api)
      // Rifiuto definitivo: la sessione è chiusa e il 401 originale resta l'esito giusto
      if (outcome === 'ended') return result
      // Errore passeggero: la sessione è valida, il problema è il server
      if (outcome === 'failed') return { error: REFRESH_FAILED_ERROR }
    }
    return rawBaseQuery(args, api, extraOptions)
  }
}

const tokenListeners = new Set<() => void>()

/**
 * Registra un listener chiamato a ogni refresh riuscito (lo usa il client STOMP per riconnettersi con il
 * token nuovo, sezione 4.13). Restituisce la funzione che lo annulla.
 */
export function onTokenRefreshed(listener: () => void): () => void {
  tokenListeners.add(listener)
  return () => {
    tokenListeners.delete(listener)
  }
}

/** Avvisa i listener registrati con `onTokenRefreshed`. */
export function notifyTokenRefreshed() {
  tokenListeners.forEach((listener) => listener())
}

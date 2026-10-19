import { createApi } from '@reduxjs/toolkit/query/react'
import {
  sessionEnded,
  sessionStarted,
  tokenRefreshed,
  type AuthState,
} from '@/features/auth/authSlice'
import type { ErrorResponse } from '@/types/common'
import type { LoginResponse, SuspensionDetails } from '@/types/users'
import {
  createBaseQueryWithReauth,
  CSRF_HEADERS,
  errorCode,
  notifyTokenRefreshed,
  type RefreshOutcome,
  type SessionApi,
} from './baseQuery'
import { TAG_TYPES } from './tags'

/** Attesa prima di ritentare il refresh dopo un 409: il browser deve avere il cookie nuovo (progettazione, sezione 4.8). */
const REFRESH_RETRY_DELAY_MS = 1000

/**
 * Unica API di RTK Query: ogni area aggiunge i propri endpoint con `api.injectEndpoints` dalla sua cartella
 * `features/<area>/api/`. Gli errori arrivano come `FetchBaseQueryError` con l'`ErrorResponse` in `data`.
 */
export const api = createApi({
  reducerPath: 'api',
  // Una funzione che rimanda a `refreshSession`: `api` e `refreshSession` si definiscono insieme in questo file
  baseQuery: createBaseQueryWithReauth((sessionApi) => refreshSession(sessionApi)),
  tagTypes: TAG_TYPES,
  endpoints: (build) => ({
    /** Rinnovo dell'access token con il cookie di refresh (progettazione, sezione 4.8). Lo chiama `refreshSession`. */
    refresh: build.mutation<LoginResponse, void>({
      query: () => ({ url: '/api/auth/refresh', method: 'POST', headers: CSRF_HEADERS }),
    }),
  }),
})

/** Un'unica richiesta di refresh alla volta per scheda: le richieste in attesa condividono la stessa promessa. */
let refreshInFlight: Promise<RefreshOutcome> | null = null

/** Rinnova la sessione con il cookie di refresh (progettazione, sezioni 4.8 e 4.13), una richiesta alla volta. */
export function refreshSession(sessionApi: SessionApi): Promise<RefreshOutcome> {
  refreshInFlight ??= doRefresh(sessionApi).finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

async function doRefresh(sessionApi: SessionApi): Promise<RefreshOutcome> {
  // Al massimo due tentativi: il secondo solo dopo un 409 REFRESH_CONFLICT (refresh concorrente di un'altra scheda)
  for (let attempt = 0; attempt < 2; attempt++) {
    // `track: false`: il risultato non resta nello stato della cache
    const result = await sessionApi.dispatch(
      api.endpoints.refresh.initiate(undefined, { track: false }),
    )

    if ('data' in result && result.data) {
      const status = (sessionApi.getState() as { auth: AuthState }).auth.status
      sessionApi.dispatch(
        status === 'authenticated' ? tokenRefreshed(result.data) : sessionStarted(result.data),
      )
      notifyTokenRefreshed()
      return 'refreshed'
    }
    // Un errore senza `status` (eccezione JS) si tratta come passeggero
    const error =
      'error' in result && result.error && 'status' in result.error ? result.error : null
    const httpStatus = typeof error?.status === 'number' ? error.status : undefined
    if (httpStatus === 409) {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, REFRESH_RETRY_DELAY_MS))
        continue
      }
      return 'failed'
    }
    // Rifiuti definitivi: token assente, scaduto, riusato (401) o account sospeso (403)
    if (httpStatus === 401) {
      sessionApi.dispatch(sessionEnded())
      return 'ended'
    }
    if (httpStatus === 403 && errorCode(error?.data) === 'ACCOUNT_SUSPENDED') {
      sessionApi.dispatch(sessionEnded({ suspension: suspensionOf(error?.data) }))
      return 'ended'
    }
    return 'failed'
  }
  return 'failed'
}

/** Dettagli della sospensione da `ErrorResponse.details`; senza dettagli validi, motivo vuoto. */
function suspensionOf(body: unknown): SuspensionDetails {
  const details = (body as Partial<ErrorResponse> | null)?.details ?? {}
  return {
    suspensionReason: typeof details.suspensionReason === 'string' ? details.suspensionReason : '',
    suspendedUntil: typeof details.suspendedUntil === 'string' ? details.suspendedUntil : null,
  }
}

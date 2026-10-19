import { http, HttpResponse } from 'msw'
import { makeLoginResponse } from '@/test/fixtures/users'
import type { LoginResponse } from '@/types/users'

// Handler MSW degli endpoint di auth, condivisi dai test: ogni test li registra con server.use(...).

/** Corpo di un `ErrorResponse` del backend. */
export function errorResponse(status: number, code: string, details: Record<string, unknown> = {}) {
  return {
    status,
    code,
    error: 'Errore',
    message: 'Messaggio del backend',
    fields: {},
    details,
    timestamp: '2026-10-19T10:00:00Z',
  }
}

/** Refresh riuscito: restituisce la sessione indicata (o una di prova) e conta le chiamate in `calls`. */
export function refreshSucceeds(login: LoginResponse = makeLoginResponse(), calls: Request[] = []) {
  return http.post('*/api/auth/refresh', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(login)
  })
}

/** Refresh rifiutato con lo status e il codice del backend (es. 401 `REFRESH_TOKEN_INVALID`). */
export function refreshRejected(status: number, code: string, calls: Request[] = [], details = {}) {
  return http.post('*/api/auth/refresh', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code, details), { status })
  })
}

/** Logout: 204 senza corpo, come il backend; registra le richieste ricevute in `calls`. */
export function logoutSucceeds(calls: Request[] = []) {
  return http.delete('*/api/auth/refresh', ({ request }) => {
    calls.push(request.clone())
    return new HttpResponse(null, { status: 204 })
  })
}

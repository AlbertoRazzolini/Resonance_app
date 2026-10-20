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

/** Registrazione riuscita: 201 con la sola email ricevuta, come il backend; registra le richieste in `calls`. */
export function registerSucceeds(calls: Request[] = []) {
  return http.post('*/api/auth/register', async ({ request }) => {
    calls.push(request.clone())
    const body = (await request.clone().json()) as { email: string }
    return HttpResponse.json({ email: body.email }, { status: 201 })
  })
}

/** Registrazione rifiutata con status e codice del backend; `fields` sono gli errori dei campi (`VALIDATION_ERROR`). */
export function registerRejected(
  status: number,
  code: string,
  fields: Record<string, string> = {},
  calls: Request[] = [],
) {
  return http.post('*/api/auth/register', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json({ ...errorResponse(status, code), fields }, { status })
  })
}

/** Verifica riuscita: restituisce la sessione indicata (o una di prova) e registra le richieste in `calls`. */
export function verifySucceeds(login: LoginResponse = makeLoginResponse(), calls: Request[] = []) {
  return http.post('*/api/auth/verify', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(login)
  })
}

/** Verifica rifiutata con status e codice del backend (es. 400 `CODE_INVALID`, 403 `ACCOUNT_SUSPENDED` con `details`). */
export function verifyRejected(status: number, code: string, calls: Request[] = [], details = {}) {
  return http.post('*/api/auth/verify', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code, details), { status })
  })
}

/** Reinvio del codice: 204 senza corpo, come il backend (anche per email sconosciute); registra le richieste in `calls`. */
export function resendSucceeds(calls: Request[] = []) {
  return http.post('*/api/auth/resend-code', ({ request }) => {
    calls.push(request.clone())
    return new HttpResponse(null, { status: 204 })
  })
}

/** Reinvio rifiutato con status e codice del backend (es. 429 `TOO_MANY_REQUESTS`). */
export function resendRejected(status: number, code: string, calls: Request[] = []) {
  return http.post('*/api/auth/resend-code', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

/** Password dimenticata: 204 senza corpo, sempre (anche per email sconosciute); registra le richieste in `calls`. */
export function forgotSucceeds(calls: Request[] = []) {
  return http.post('*/api/auth/password/forgot', ({ request }) => {
    calls.push(request.clone())
    return new HttpResponse(null, { status: 204 })
  })
}

/** Password dimenticata rifiutata con status e codice del backend (es. 429 `TOO_MANY_REQUESTS`). */
export function forgotRejected(status: number, code: string, calls: Request[] = []) {
  return http.post('*/api/auth/password/forgot', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

/** Reset riuscito: 204 senza corpo; registra le richieste ricevute in `calls`. */
export function resetSucceeds(calls: Request[] = []) {
  return http.post('*/api/auth/password/reset', ({ request }) => {
    calls.push(request.clone())
    return new HttpResponse(null, { status: 204 })
  })
}

/** Reset rifiutato con status e codice del backend (es. 400 `CODE_INVALID`, 403 `ACCOUNT_SUSPENDED` con `details`). */
export function resetRejected(
  status: number,
  code: string,
  calls: Request[] = [],
  details = {},
  fields: Record<string, string> = {},
) {
  return http.post('*/api/auth/password/reset', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json({ ...errorResponse(status, code, details), fields }, { status })
  })
}

/** Login riuscito: restituisce la sessione indicata (o una di prova) e registra le richieste ricevute in `calls`. */
export function loginSucceeds(login: LoginResponse = makeLoginResponse(), calls: Request[] = []) {
  return http.post('*/api/auth/login', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(login)
  })
}

/** Login rifiutato con lo status e il codice del backend (es. 401 `INVALID_CREDENTIALS`, 403 `ACCOUNT_SUSPENDED`). */
export function loginRejected(status: number, code: string, calls: Request[] = [], details = {}) {
  return http.post('*/api/auth/login', ({ request }) => {
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

import { http, HttpResponse } from 'msw'
import { makeMe } from '@/test/fixtures/users'
import type { MeResponse, PublicUserResponse, UpdateProfileRequest } from '@/types/users'
import { errorResponse } from './auth'

// Handler MSW degli endpoint degli utenti, condivisi dai test: ogni test li registra con server.use(...).

/**
 * `PATCH /api/users/me` riuscito: risponde con il profilo `base` più i campi ricevuti (come fa il backend) e registra
 * le richieste in `calls`. Una stringa vuota ricevuta diventa `null`, come nel database.
 */
export function profileUpdated(base: MeResponse = makeMe(), calls: Request[] = []) {
  return http.patch('*/api/users/me', async ({ request }) => {
    calls.push(request.clone())
    const body = (await request.clone().json()) as UpdateProfileRequest
    const merged: Record<string, unknown> = { ...base }
    for (const [field, value] of Object.entries(body)) merged[field] = value === '' ? null : value
    return HttpResponse.json(merged)
  })
}

/** `PATCH /api/users/me` rifiutato con status e codice del backend; `fields` sono gli errori dei campi (`VALIDATION_ERROR`). */
export function profileRejected(
  status: number,
  code: string,
  fields: Record<string, string> = {},
  calls: Request[] = [],
) {
  return http.patch('*/api/users/me', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json({ ...errorResponse(status, code), fields }, { status })
  })
}

/** `DELETE /api/users/me/location` riuscito: risponde con il profilo `base` senza coordinate. */
export function locationRemoved(base: MeResponse = makeMe(), calls: Request[] = []) {
  return http.delete('*/api/users/me/location', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json({ ...base, latitude: null, longitude: null })
  })
}

/** Rimozione della posizione rifiutata con status e codice del backend. */
export function locationRemovalRejected(status: number, code: string, calls: Request[] = []) {
  return http.delete('*/api/users/me/location', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

/** Attivazione di un ruolo riuscita (`POST /api/users/me/roles/musician` o `host`): risponde con `me` e registra le richieste. */
export function roleActivated(me: MeResponse, calls: Request[] = []) {
  return http.post('*/api/users/me/roles/:role', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(me)
  })
}

/** Attivazione di un ruolo rifiutata con status e codice del backend. */
export function roleActivationRejected(status: number, code: string, calls: Request[] = []) {
  return http.post('*/api/users/me/roles/:role', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

/** `GET /api/users/{id}` riuscito: risponde con il profilo pubblico indicato e registra le richieste. */
export function publicUserFound(user: PublicUserResponse, calls: Request[] = []) {
  return http.get('*/api/users/:id', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(user)
  })
}

/** `GET /api/users/{id}` rifiutato con status e codice del backend (es. 404 `NOT_FOUND`). */
export function publicUserRejected(status: number, code: string, calls: Request[] = []) {
  return http.get('*/api/users/:id', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

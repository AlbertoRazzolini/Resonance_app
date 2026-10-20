import { http, HttpResponse } from 'msw'
import type { PageResponse } from '@/types/common'
import type { IndieEventResponse, OfficialConcertResponse } from '@/types/events'
import { errorResponse } from './auth'

// Handler MSW degli endpoint degli eventi, condivisi dai test: ogni test li registra con server.use(...).

const CONCERTS = '*/api/official-concerts'
const INDIE = '*/api/indie-events'

/** Ricerca di concerti vicini riuscita: risponde con la pagina richiesta (`pages[page]`) e registra le richieste. */
export function nearbyConcertsFound(pages: PageResponse<OfficialConcertResponse>[], calls: Request[] = []) {
  return http.get(`${CONCERTS}/nearby`, ({ request }) => {
    calls.push(request.clone())
    const page = Number(new URL(request.url).searchParams.get('page') ?? 0)
    return HttpResponse.json(pages[page])
  })
}

/** Ricerca di indie event vicini riuscita: risponde con la pagina richiesta (`pages[page]`) e registra le richieste. */
export function nearbyIndieFound(pages: PageResponse<IndieEventResponse>[], calls: Request[] = []) {
  return http.get(`${INDIE}/nearby`, ({ request }) => {
    calls.push(request.clone())
    const page = Number(new URL(request.url).searchParams.get('page') ?? 0)
    return HttpResponse.json(pages[page])
  })
}

/** Ricerca di concerti vicini rifiutata con status e codice del backend. */
export function nearbyConcertsRejected(status: number, code: string, calls: Request[] = []) {
  return http.get(`${CONCERTS}/nearby`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

/** Ricerca di indie event vicini rifiutata con status e codice del backend. */
export function nearbyIndieRejected(status: number, code: string, calls: Request[] = []) {
  return http.get(`${INDIE}/nearby`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

/** `GET /api/official-concerts/{id}` riuscito: risponde con il concerto indicato. */
export function concertFound(concert: OfficialConcertResponse, calls: Request[] = []) {
  return http.get(`${CONCERTS}/:id`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(concert)
  })
}

/** `GET /api/official-concerts/{id}` rifiutato con status e codice del backend (es. 404 `NOT_FOUND`). */
export function concertRejected(status: number, code: string, calls: Request[] = []) {
  return http.get(`${CONCERTS}/:id`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

/** `GET /api/indie-events/{id}` riuscito: risponde con l'indie event indicato. */
export function indieEventFound(event: IndieEventResponse, calls: Request[] = []) {
  return http.get(`${INDIE}/:id`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(event)
  })
}

/** `POST /api/official-concerts` riuscito (201): risponde con il concerto indicato e registra le richieste. */
export function concertCreated(concert: OfficialConcertResponse, calls: Request[] = []) {
  return http.post(CONCERTS, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(concert, { status: 201 })
  })
}

/** `POST /api/official-concerts` rifiutato con status, codice ed eventuali errori dei campi (es. `ADDRESS_NOT_FOUND`). */
export function concertCreateRejected(
  status: number,
  code: string,
  fields: Record<string, string> = {},
  calls: Request[] = [],
) {
  return http.post(CONCERTS, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json({ ...errorResponse(status, code), fields }, { status })
  })
}

/** `POST /api/indie-events` riuscito (201): risponde con l'indie event indicato e registra le richieste. */
export function indieEventCreated(event: IndieEventResponse, calls: Request[] = []) {
  return http.post(INDIE, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(event, { status: 201 })
  })
}

/** `POST /api/indie-events` rifiutato con status, codice ed eventuali errori dei campi (es. `ADDRESS_NOT_FOUND`). */
export function indieEventCreateRejected(
  status: number,
  code: string,
  fields: Record<string, string> = {},
  calls: Request[] = [],
) {
  return http.post(INDIE, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json({ ...errorResponse(status, code), fields }, { status })
  })
}

/** `GET /api/indie-events/{id}` rifiutato con status e codice del backend (es. 404 `NOT_FOUND`). */
export function indieEventRejected(status: number, code: string, calls: Request[] = []) {
  return http.get(`${INDIE}/:id`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

/** `GET /api/official-concerts/mine` riuscito: risponde con la pagina richiesta (`pages[page]`) e registra le richieste. */
export function myConcertsFound(pages: PageResponse<OfficialConcertResponse>[], calls: Request[] = []) {
  return http.get(`${CONCERTS}/mine`, ({ request }) => {
    calls.push(request.clone())
    const page = Number(new URL(request.url).searchParams.get('page') ?? 0)
    return HttpResponse.json(pages[page])
  })
}

/** `GET /api/indie-events/mine` riuscito: risponde con la pagina richiesta (`pages[page]`) e registra le richieste. */
export function myIndieFound(pages: PageResponse<IndieEventResponse>[], calls: Request[] = []) {
  return http.get(`${INDIE}/mine`, ({ request }) => {
    calls.push(request.clone())
    const page = Number(new URL(request.url).searchParams.get('page') ?? 0)
    return HttpResponse.json(pages[page])
  })
}

/** `GET /api/official-concerts/mine` rifiutato con status e codice del backend. */
export function myConcertsRejected(status: number, code: string) {
  return http.get(`${CONCERTS}/mine`, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/** `PATCH /api/indie-events/{id}/publish` riuscito: risponde con l'indie event indicato (ora pubblicato). */
export function indiePublished(event: IndieEventResponse, calls: Request[] = []) {
  return http.patch(`${INDIE}/:id/publish`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(event)
  })
}

/** `PATCH /api/indie-events/{id}/publish` rifiutato (es. 400 `EVENT_DATE_PAST`, 409 `EVENT_ALREADY_PUBLISHED`). */
export function indiePublishRejected(status: number, code: string) {
  return http.patch(`${INDIE}/:id/publish`, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/** `DELETE /api/official-concerts/{id}` riuscito (204): registra la richiesta, con il motivo nel body se c'è. */
export function concertDeleted(calls: Request[] = []) {
  return http.delete(`${CONCERTS}/:id`, ({ request }) => {
    calls.push(request.clone())
    return new HttpResponse(null, { status: 204 })
  })
}

/** `DELETE /api/indie-events/{id}` riuscito (204): registra la richiesta, con il motivo nel body se c'è. */
export function indieDeleted(calls: Request[] = []) {
  return http.delete(`${INDIE}/:id`, ({ request }) => {
    calls.push(request.clone())
    return new HttpResponse(null, { status: 204 })
  })
}

/** `DELETE /api/official-concerts/{id}` rifiutato (es. 403 `NOT_OWNER`). */
export function concertDeleteRejected(status: number, code: string) {
  return http.delete(`${CONCERTS}/:id`, () => HttpResponse.json(errorResponse(status, code), { status }))
}

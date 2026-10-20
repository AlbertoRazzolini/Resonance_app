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

/** `GET /api/indie-events/{id}` rifiutato con status e codice del backend (es. 404 `NOT_FOUND`). */
export function indieEventRejected(status: number, code: string, calls: Request[] = []) {
  return http.get(`${INDIE}/:id`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

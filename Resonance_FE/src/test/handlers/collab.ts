import { http, HttpResponse } from 'msw'
import type { PageResponse } from '@/types/common'
import type { ApplicationResponse, CollabPostResponse } from '@/types/collab'
import { errorResponse } from './auth'

// Handler MSW degli endpoint della bacheca collab, condivisi dai test: ogni test li registra con server.use(...).

const COLLAB = '*/api/collab-posts'

/** `GET /api/collab-posts` riuscito: risponde con la pagina richiesta (`pages[page]`) e registra le richieste. */
export function collabFound(pages: PageResponse<CollabPostResponse>[], calls: Request[] = []) {
  return http.get(COLLAB, ({ request }) => {
    calls.push(request.clone())
    const page = Number(new URL(request.url).searchParams.get('page') ?? 0)
    return HttpResponse.json(pages[page])
  })
}

/** `GET /api/collab-posts` rifiutato con status e codice del backend. */
export function collabRejected(status: number, code: string) {
  return http.get(COLLAB, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/** `GET /api/collab-posts/mine` riuscito: risponde con la pagina richiesta (`pages[page]`) e registra le richieste. */
export function myCollabFound(pages: PageResponse<CollabPostResponse>[], calls: Request[] = []) {
  return http.get(`${COLLAB}/mine`, ({ request }) => {
    calls.push(request.clone())
    const page = Number(new URL(request.url).searchParams.get('page') ?? 0)
    return HttpResponse.json(pages[page])
  })
}

/** `GET /api/collab-posts/mine` rifiutato con status e codice del backend. */
export function myCollabRejected(status: number, code: string) {
  return http.get(`${COLLAB}/mine`, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/** `GET /api/collab-posts/{id}` riuscito: risponde con l'annuncio indicato. */
export function collabPostFound(post: CollabPostResponse, calls: Request[] = []) {
  return http.get(`${COLLAB}/:id`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(post)
  })
}

/** `GET /api/collab-posts/{id}` rifiutato con status e codice del backend (es. 404 `NOT_FOUND`). */
export function collabPostRejected(status: number, code: string) {
  return http.get(`${COLLAB}/:id`, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/** `POST /api/collab-posts` riuscito (201): risponde con l'annuncio indicato e registra le richieste. */
export function collabCreated(post: CollabPostResponse, calls: Request[] = []) {
  return http.post(COLLAB, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(post, { status: 201 })
  })
}

/** `POST /api/collab-posts` rifiutato con status, codice ed eventuali errori dei campi. */
export function collabCreateRejected(
  status: number,
  code: string,
  fields: Record<string, string> = {},
  calls: Request[] = [],
) {
  return http.post(COLLAB, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json({ ...errorResponse(status, code), fields }, { status })
  })
}

/** `PATCH /api/collab-posts/{id}/close` riuscito (200): risponde con l'annuncio indicato (ora chiuso). */
export function collabClosed(post: CollabPostResponse, calls: Request[] = []) {
  return http.patch(`${COLLAB}/:id/close`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(post)
  })
}

/** `PATCH /api/collab-posts/{id}/close` rifiutato (es. 403 `NOT_OWNER`). */
export function collabCloseRejected(status: number, code: string) {
  return http.patch(`${COLLAB}/:id/close`, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/** `DELETE /api/collab-posts/{id}` riuscito (204): registra la richiesta, con il motivo nel body se c'è. */
export function collabDeleted(calls: Request[] = []) {
  return http.delete(`${COLLAB}/:id`, ({ request }) => {
    calls.push(request.clone())
    return new HttpResponse(null, { status: 204 })
  })
}

/** `DELETE /api/collab-posts/{id}` rifiutato (es. 403 `NOT_OWNER`). */
export function collabDeleteRejected(status: number, code: string) {
  return http.delete(`${COLLAB}/:id`, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/** `POST /api/collab-posts/{id}/applications` riuscito (201): risponde con l'esito indicato e registra le richieste. */
export function applicationSent(result: ApplicationResponse, calls: Request[] = []) {
  return http.post(`${COLLAB}/:id/applications`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(result, { status: 201 })
  })
}

/** `POST /api/collab-posts/{id}/applications` rifiutato (409 `COLLAB_CLOSED`, 400 `CANNOT_APPLY_OWN_POST`, 429…). */
export function applicationRejected(status: number, code: string, calls: Request[] = []) {
  return http.post(`${COLLAB}/:id/applications`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

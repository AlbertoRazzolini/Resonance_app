import { delay, http, HttpResponse } from 'msw'
import type { PageResponse } from '@/types/common'
import type { FeedPostResponse, LikeStatusResponse } from '@/types/feed'
import { errorResponse } from './auth'

// Handler MSW degli endpoint del feed, condivisi dai test: ogni test li registra con server.use(...).

const FEED = '*/api/feed-posts'

/** `GET /api/feed-posts` riuscito: risponde con la pagina richiesta (`pages[page]`) e registra le richieste. */
export function feedFound(pages: PageResponse<FeedPostResponse>[], calls: Request[] = []) {
  return http.get(FEED, ({ request }) => {
    calls.push(request.clone())
    const page = Number(new URL(request.url).searchParams.get('page') ?? 0)
    return HttpResponse.json(pages[page])
  })
}

/** `GET /api/feed-posts` rifiutato con status e codice del backend (es. 400 `VALIDATION_ERROR`). */
export function feedRejected(status: number, code: string, calls: Request[] = []) {
  return http.get(FEED, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

/** `GET /api/feed-posts/mine` riuscito: risponde con la pagina richiesta (`pages[page]`) e registra le richieste. */
export function myPostsFound(pages: PageResponse<FeedPostResponse>[], calls: Request[] = []) {
  return http.get(`${FEED}/mine`, ({ request }) => {
    calls.push(request.clone())
    const page = Number(new URL(request.url).searchParams.get('page') ?? 0)
    return HttpResponse.json(pages[page])
  })
}

/** `GET /api/feed-posts/mine` rifiutato con status e codice del backend. */
export function myPostsRejected(status: number, code: string) {
  return http.get(`${FEED}/mine`, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/** `POST /api/feed-posts` riuscito (201): risponde con il post indicato e registra le richieste; `waitMs` ritarda la risposta. */
export function postCreated(post: FeedPostResponse, calls: Request[] = [], waitMs = 0) {
  return http.post(FEED, async ({ request }) => {
    calls.push(request.clone())
    if (waitMs) await delay(waitMs)
    return HttpResponse.json(post, { status: 201 })
  })
}

/** `POST /api/feed-posts` rifiutato con status, codice ed eventuali errori dei campi (`VALIDATION_ERROR`). */
export function postCreateRejected(
  status: number,
  code: string,
  fields: Record<string, string> = {},
  calls: Request[] = [],
) {
  return http.post(FEED, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json({ ...errorResponse(status, code), fields }, { status })
  })
}

/** `DELETE /api/feed-posts/{id}` riuscito (204) e registra le richieste. */
export function postDeleted(calls: Request[] = []) {
  return http.delete(`${FEED}/:id`, ({ request }) => {
    calls.push(request.clone())
    return new HttpResponse(null, { status: 204 })
  })
}

/** `DELETE /api/feed-posts/{id}` rifiutato con status e codice del backend (es. 403 `NOT_OWNER`). */
export function postDeleteRejected(status: number, code: string, calls: Request[] = []) {
  return http.delete(`${FEED}/:id`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

/**
 * `PUT /api/feed-posts/{id}/like` riuscito: risponde con lo stato vero. Con `waitMs` la risposta tarda, così un test
 * può guardare lo stato ottimistico prima dell'arrivo della risposta.
 */
export function likeSet(status: LikeStatusResponse, calls: Request[] = [], waitMs = 0) {
  return http.put(`${FEED}/:id/like`, async ({ request }) => {
    calls.push(request.clone())
    if (waitMs) await delay(waitMs)
    return HttpResponse.json(status)
  })
}

/** `DELETE /api/feed-posts/{id}/like` riuscito: come `likeSet`, per togliere il like. */
export function likeRemoved(status: LikeStatusResponse, calls: Request[] = [], waitMs = 0) {
  return http.delete(`${FEED}/:id/like`, async ({ request }) => {
    calls.push(request.clone())
    if (waitMs) await delay(waitMs)
    return HttpResponse.json(status)
  })
}

/** `PUT /api/feed-posts/{id}/like` rifiutato con status e codice del backend (es. 500 `INTERNAL_ERROR`). */
export function likeSetRejected(status: number, code: string, calls: Request[] = [], waitMs = 0) {
  return http.put(`${FEED}/:id/like`, async ({ request }) => {
    calls.push(request.clone())
    if (waitMs) await delay(waitMs)
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

/** `DELETE /api/feed-posts/{id}/like` rifiutato con status e codice del backend. */
export function likeRemovedRejected(status: number, code: string, calls: Request[] = [], waitMs = 0) {
  return http.delete(`${FEED}/:id/like`, async ({ request }) => {
    calls.push(request.clone())
    if (waitMs) await delay(waitMs)
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

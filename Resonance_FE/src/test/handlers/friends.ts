import { http, HttpResponse } from 'msw'
import type { PageResponse } from '@/types/common'
import type {
  FriendshipListType,
  FriendshipResponse,
  FriendshipSummary,
  UserSearchResult,
} from '@/types/friends'
import { errorResponse } from './auth'

// Handler MSW degli endpoint di ricerca utenti e amicizie, condivisi dai test: ogni test li registra con server.use(...).

const SEARCH = '*/api/users/search'
const FRIENDSHIPS = '*/api/friendships'

/** Azioni sulla singola amicizia che rispondono a `POST /api/friendships/{id}/{action}`. */
export type FriendshipAction = 'accept' | 'decline' | 'cancel'

/** `GET /api/users/search` riuscito: risponde con la pagina richiesta (`pages[page]`) e registra le richieste. */
export function searchFound(pages: PageResponse<UserSearchResult>[], calls: Request[] = []) {
  return http.get(SEARCH, ({ request }) => {
    calls.push(request.clone())
    const page = Number(new URL(request.url).searchParams.get('page') ?? 0)
    return HttpResponse.json(pages[page])
  })
}

/** `GET /api/users/search` rifiutato con status e codice del backend (es. 429 `TOO_MANY_REQUESTS`). */
export function searchRejected(status: number, code: string) {
  return http.get(SEARCH, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/**
 * `GET /api/friendships?type=` riuscito: risponde con la pagina richiesta (`pages[type][page]`) e registra le richieste;
 * un tipo senza pagine risponde con un elenco vuoto.
 */
export function friendshipsFound(
  pages: Partial<Record<FriendshipListType, PageResponse<FriendshipResponse>[]>>,
  calls: Request[] = [],
) {
  return http.get(FRIENDSHIPS, ({ request }) => {
    calls.push(request.clone())
    const params = new URL(request.url).searchParams
    const type = params.get('type') as FriendshipListType
    const page = Number(params.get('page') ?? 0)
    const body = pages[type]?.[page] ?? {
      content: [],
      page,
      size: 20,
      totalElements: 0,
      totalPages: 1,
    }
    return HttpResponse.json(body)
  })
}

/** `GET /api/friendships` rifiutato con status e codice del backend. */
export function friendshipsRejected(status: number, code: string) {
  return http.get(FRIENDSHIPS, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/** `GET /api/friendships/with/{userId}` riuscito: risponde con lo stato indicato e registra le richieste. */
export function friendshipStateFound(summary: FriendshipSummary, calls: Request[] = []) {
  return http.get(`${FRIENDSHIPS}/with/:userId`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(summary)
  })
}

/** `GET /api/friendships/with/{userId}` rifiutato con status e codice del backend (es. 429 `TOO_MANY_REQUESTS`). */
export function friendshipStateRejected(status: number, code: string) {
  return http.get(`${FRIENDSHIPS}/with/:userId`, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/** `POST /api/friendships` riuscito (201): risponde con l'amicizia indicata e registra le richieste. */
export function friendshipRequested(friendship: FriendshipResponse, calls: Request[] = []) {
  return http.post(FRIENDSHIPS, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(friendship, { status: 201 })
  })
}

/** `POST /api/friendships` rifiutato con status e codice del backend (es. 409 `FRIEND_REQUEST_ALREADY_RECEIVED`). */
export function friendshipRequestRejected(status: number, code: string) {
  return http.post(FRIENDSHIPS, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/**
 * `POST /api/friendships/{id}/{action}` riuscito: `accept` risponde 200 con l'amicizia indicata, `decline` e `cancel`
 * 204. Registra le richieste.
 */
export function friendshipActionSucceeds(
  action: FriendshipAction,
  calls: Request[] = [],
  friendship?: FriendshipResponse,
) {
  return http.post(`${FRIENDSHIPS}/:id/${action}`, ({ request }) => {
    calls.push(request.clone())
    return action === 'accept' && friendship
      ? HttpResponse.json(friendship)
      : new HttpResponse(null, { status: 204 })
  })
}

/** `POST /api/friendships/{id}/{action}` rifiutato con status e codice del backend. */
export function friendshipActionRejected(action: FriendshipAction, status: number, code: string) {
  return http.post(`${FRIENDSHIPS}/:id/${action}`, () =>
    HttpResponse.json(errorResponse(status, code), { status }),
  )
}

/** `DELETE /api/friendships/{id}` riuscito (204): registra le richieste. */
export function friendshipRemoved(calls: Request[] = []) {
  return http.delete(`${FRIENDSHIPS}/:id`, ({ request }) => {
    calls.push(request.clone())
    return new HttpResponse(null, { status: 204 })
  })
}

/** `DELETE /api/friendships/{id}` rifiutato con status e codice del backend. */
export function friendshipRemoveRejected(status: number, code: string) {
  return http.delete(`${FRIENDSHIPS}/:id`, () =>
    HttpResponse.json(errorResponse(status, code), { status }),
  )
}

import { http, HttpResponse } from 'msw'
import type { PageResponse } from '@/types/common'
import type { NotificationResponse } from '@/types/notifications'
import { errorResponse } from './auth'

// Handler MSW degli endpoint delle notifiche, condivisi dai test: ogni test li registra con server.use(...).

const NOTIFICATIONS = '*/api/notifications'

/** Pagina di notifiche di prova; `totalElements` e `totalPages` si cambiano dove serve (di norma una pagina sola). */
export function notificationPage(
  content: NotificationResponse[],
  { page = 0, totalPages = 1, totalElements = content.length }: { page?: number; totalPages?: number; totalElements?: number } = {},
): PageResponse<NotificationResponse> {
  return { content, page, size: 10, totalElements, totalPages }
}

/**
 * `GET /api/notifications` riuscito: risponde con la pagina richiesta (`pages[page]`, vuota se manca) e registra le
 * richieste in `calls`.
 */
export function notificationsFound(pages: PageResponse<NotificationResponse>[], calls: Request[] = []) {
  return http.get(NOTIFICATIONS, ({ request }) => {
    calls.push(request.clone())
    const page = Number(new URL(request.url).searchParams.get('page') ?? 0)
    return HttpResponse.json(pages[page] ?? notificationPage([], { page }))
  })
}

/** `GET /api/notifications` rifiutato con status e codice del backend. */
export function notificationsRejected(status: number, code: string) {
  return http.get(NOTIFICATIONS, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/** `GET /api/notifications/unread-count` riuscito: risponde `{count}` e registra le richieste. */
export function unreadCountFound(count: number | (() => number), calls: Request[] = []) {
  return http.get(`${NOTIFICATIONS}/unread-count`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json({ count: typeof count === 'function' ? count() : count })
  })
}

/** `GET /api/notifications/unread-count` rifiutato con status e codice del backend. */
export function unreadCountRejected(status: number, code: string) {
  return http.get(`${NOTIFICATIONS}/unread-count`, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/** `POST /api/notifications/{id}/read` riuscito (204): registra le richieste. */
export function notificationReadSucceeds(calls: Request[] = []) {
  return http.post(`${NOTIFICATIONS}/:id/read`, ({ request }) => {
    calls.push(request.clone())
    return new HttpResponse(null, { status: 204 })
  })
}

/** `POST /api/notifications/{id}/read` rifiutato con status e codice del backend (es. 404 `NOT_FOUND`). */
export function notificationReadRejected(status: number, code: string) {
  return http.post(`${NOTIFICATIONS}/:id/read`, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/** `POST /api/notifications/read-all` riuscito (204): registra le richieste. */
export function readAllSucceeds(calls: Request[] = []) {
  return http.post(`${NOTIFICATIONS}/read-all`, ({ request }) => {
    calls.push(request.clone())
    return new HttpResponse(null, { status: 204 })
  })
}

/** `POST /api/notifications/read-all` rifiutato con status e codice del backend. */
export function readAllRejected(status: number, code: string) {
  return http.post(`${NOTIFICATIONS}/read-all`, () => HttpResponse.json(errorResponse(status, code), { status }))
}

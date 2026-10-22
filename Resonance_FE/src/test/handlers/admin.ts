import { http, HttpResponse } from 'msw'
import type { AdminUserResponse, HiddenContentResponse } from '@/types/admin'
import type { PageResponse } from '@/types/common'
import { errorResponse } from './auth'

// Handler MSW degli endpoint di amministrazione, condivisi dai test: ogni test li registra con server.use(...).

const USERS = '*/api/admin/users'
const MODERATION = '*/api/admin/moderation'

/** `GET /api/admin/users` riuscito: risponde con la pagina richiesta (`pages[page]`) e registra le richieste. */
export function adminUsersFound(pages: PageResponse<AdminUserResponse>[], calls: Request[] = []) {
  return http.get(USERS, ({ request }) => {
    calls.push(request.clone())
    const page = Number(new URL(request.url).searchParams.get('page') ?? 0)
    return HttpResponse.json(pages[page])
  })
}

/** `GET /api/admin/users` rifiutato con status e codice del backend. */
export function adminUsersRejected(status: number, code: string) {
  return http.get(USERS, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/** `POST /api/admin/users/{id}/suspension` riuscito: risponde con l'utente indicato e registra le richieste. */
export function suspensionSucceeds(user: AdminUserResponse, calls: Request[] = []) {
  return http.post(`${USERS}/:id/suspension`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(user)
  })
}

/** `POST /api/admin/users/{id}/suspension` rifiutato con status e codice del backend (es. 403 `INSUFFICIENT_PLATFORM_LEVEL`). */
export function suspensionRejected(status: number, code: string, calls: Request[] = []) {
  return http.post(`${USERS}/:id/suspension`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

/** `DELETE /api/admin/users/{id}/suspension` riuscito: risponde con l'utente riattivato. */
export function reactivationSucceeds(user: AdminUserResponse, calls: Request[] = []) {
  return http.delete(`${USERS}/:id/suspension`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(user)
  })
}

/** `POST /api/superadmin/users/{id}/admin` riuscito: risponde con l'utente nominato. */
export function adminGranted(user: AdminUserResponse, calls: Request[] = []) {
  return http.post('*/api/superadmin/users/:id/admin', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(user)
  })
}

/** `POST /api/superadmin/users/{id}/admin` rifiutato con status e codice del backend (es. 409 `USER_NOT_VERIFIED`). */
export function adminGrantRejected(status: number, code: string, calls: Request[] = []) {
  return http.post('*/api/superadmin/users/:id/admin', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

/** `DELETE /api/superadmin/users/{id}/admin` riuscito: risponde con l'utente senza il ruolo ADMIN. */
export function adminRevoked(user: AdminUserResponse, calls: Request[] = []) {
  return http.delete('*/api/superadmin/users/:id/admin', ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(user)
  })
}

/** `POST /api/admin/moderation/{type}/{id}/hide` riuscito (204): registra le richieste con il loro corpo. */
export function contentHidden(calls: Request[] = []) {
  return http.post(`${MODERATION}/:type/:id/hide`, ({ request }) => {
    calls.push(request.clone())
    return new HttpResponse(null, { status: 204 })
  })
}

/** `POST /api/admin/moderation/{type}/{id}/hide` rifiutato con status e codice del backend. */
export function contentHideRejected(status: number, code: string, calls: Request[] = []) {
  return http.post(`${MODERATION}/:type/:id/hide`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

/** `GET /api/admin/moderation/{type}/hidden` riuscito: risponde con le pagine del tipo richiesto (`pages[type][page]`). */
export function hiddenContentFound(
  pages: Partial<Record<string, PageResponse<HiddenContentResponse>[]>>,
  calls: Request[] = [],
) {
  return http.get(`${MODERATION}/:type/hidden`, ({ request, params }) => {
    calls.push(request.clone())
    const page = Number(new URL(request.url).searchParams.get('page') ?? 0)
    const content = pages[String(params.type)]?.[page]
    return HttpResponse.json(content ?? { content: [], page, size: 20, totalElements: 0, totalPages: 0 })
  })
}

/** `POST /api/admin/moderation/{type}/{id}/restore` riuscito (204) e registra le richieste. */
export function contentRestored(calls: Request[] = []) {
  return http.post(`${MODERATION}/:type/:id/restore`, ({ request }) => {
    calls.push(request.clone())
    return new HttpResponse(null, { status: 204 })
  })
}

/** `POST /api/admin/moderation/{type}/{id}/restore` rifiutato con status e codice del backend (es. 409 `RESTORE_NOT_ALLOWED`). */
export function contentRestoreRejected(status: number, code: string, calls: Request[] = []) {
  return http.post(`${MODERATION}/:type/:id/restore`, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(errorResponse(status, code), { status })
  })
}

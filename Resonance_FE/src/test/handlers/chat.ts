import { http, HttpResponse } from 'msw'
import type { PageResponse } from '@/types/common'
import type { ConversationResponse, MessagePageResponse } from '@/types/chat'
import { errorResponse } from './auth'

// Handler MSW degli endpoint della chat, condivisi dai test: ogni test li registra con server.use(...).

const CHATS = '*/api/chats'

/** Pagina unica di conversazioni, come la restituisce il backend. */
export function conversationPage(content: ConversationResponse[]): PageResponse<ConversationResponse> {
  return { content, page: 0, size: 100, totalElements: content.length, totalPages: 1 }
}

/** `GET /api/chats` riuscito: risponde con le conversazioni indicate e registra le richieste in `calls`. */
export function conversationsFound(content: ConversationResponse[], calls: Request[] = []) {
  return http.get(CHATS, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(conversationPage(content))
  })
}

/** `GET /api/chats` rifiutato con status e codice del backend. */
export function conversationsRejected(status: number, code: string) {
  return http.get(CHATS, () => HttpResponse.json(errorResponse(status, code), { status }))
}

/**
 * `GET /api/chats/{id}/messages` riuscito: risponde con la pagina il cui indice dipende dal cursore (`pages[0]` senza
 * `before`, poi una pagina per ogni `before` già visto); registra le richieste in `calls`.
 */
export function messagesFound(conversationId: string, pages: MessagePageResponse[], calls: Request[] = []) {
  return http.get(`*/api/chats/${conversationId}/messages`, ({ request }) => {
    calls.push(request.clone())
    const before = new URL(request.url).searchParams.get('before')
    const index = before === null ? 0 : pages.findIndex((page) => page.messages.at(-1)?.id === before) + 1
    return HttpResponse.json(pages[index] ?? { messages: [], hasMore: false })
  })
}

/** `GET /api/chats/{id}/messages` rifiutato con status e codice del backend. */
export function messagesRejected(conversationId: string, status: number, code: string) {
  return http.get(`*/api/chats/${conversationId}/messages`, () =>
    HttpResponse.json(errorResponse(status, code), { status }),
  )
}

/** `PATCH /api/chats/{id}/read` riuscito (204); registra le richieste in `calls`. */
export function readSucceeds(conversationId: string, calls: Request[] = []) {
  return http.patch(`*/api/chats/${conversationId}/read`, ({ request }) => {
    calls.push(request.clone())
    return new HttpResponse(null, { status: 204 })
  })
}

/** `POST /api/chats` riuscito (200): risponde con la conversazione indicata e registra le richieste in `calls`. */
export function conversationOpened(conversation: ConversationResponse, calls: Request[] = []) {
  return http.post(CHATS, ({ request }) => {
    calls.push(request.clone())
    return HttpResponse.json(conversation)
  })
}

/** `POST /api/chats` rifiutato con status e codice del backend (es. 403 `NOT_FRIENDS`). */
export function conversationOpenRejected(status: number, code: string) {
  return http.post(CHATS, () => HttpResponse.json(errorResponse(status, code), { status }))
}

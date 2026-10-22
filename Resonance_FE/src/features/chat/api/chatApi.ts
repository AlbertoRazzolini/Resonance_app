import type { AppDispatch } from '@/app/store'
import { api } from '@/lib/api/apiSlice'
import type { PageResponse } from '@/types/common'
import type { ChatMessageResponse, ConversationResponse, MessagePageResponse } from '@/types/chat'
import { mergeHistory, withConversationRead, withHistoryMessage, withIncomingMessage } from '../chatCache'

/** Conversazioni chieste in una volta: il massimo del backend, così badge e ricerca vedono tutto (decisione 92). */
export const CONVERSATIONS_PAGE_SIZE = 100

/** Messaggi per pagina dello storico: il valore predefinito del backend (progettazione, sezione 6.9). */
export const MESSAGES_PAGE_SIZE = 30

/** Endpoint REST della chat (progettazione, sezione 6.9); l'invio dei messaggi passa invece da STOMP. */
export const chatApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * `GET /api/chats?size=100`: le conversazioni dall'ultima attività, con ultimo messaggio, non letti e `canSend`.
     * Una sola chiamata alimenta elenco, badge e ricerca; i messaggi in arrivo ne aggiornano la cache a mano.
     */
    getConversations: build.query<ConversationResponse[], void>({
      query: () => ({ url: '/api/chats', params: { page: 0, size: CONVERSATIONS_PAGE_SIZE } }),
      transformResponse: (page: PageResponse<ConversationResponse>) => page.content,
      providesTags: ['Chat'],
    }),

    /**
     * `GET /api/chats/{id}/messages`: la pagina più recente dello storico (30 messaggi, dal più recente). Una
     * rilettura (dopo una riconnessione) non sostituisce lo storico già caricato: si unisce senza doppioni né buchi.
     */
    getMessages: build.query<MessagePageResponse, string>({
      query: (conversationId) => ({
        url: `/api/chats/${encodeURIComponent(conversationId)}/messages`,
        params: { size: MESSAGES_PAGE_SIZE },
      }),
      merge: (current, incoming) => mergeHistory(current, incoming),
      providesTags: (_result, _error, conversationId) => [{ type: 'Messages' as const, id: conversationId }],
    }),

    /**
     * `GET /api/chats/{id}/messages?before=`: la pagina prima del messaggio indicato (cursore). Il risultato non resta
     * qui: si unisce allo storico di `getMessages`, così la lista è una sola.
     */
    getOlderMessages: build.query<MessagePageResponse, { conversationId: string; before: string }>({
      query: ({ conversationId, before }) => ({
        url: `/api/chats/${encodeURIComponent(conversationId)}/messages`,
        params: { before, size: MESSAGES_PAGE_SIZE },
      }),
      keepUnusedDataFor: 0,
      onQueryStarted: async ({ conversationId }, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled
          dispatch(
            chatApi.util.updateQueryData('getMessages', conversationId, (history) => mergeHistory(history, data)),
          )
        } catch {
          // L'errore lo mostra chi ha chiesto la pagina (l'errore della query)
        }
      },
    }),

    /** `PATCH /api/chats/{id}/read` (204): segna letti i messaggi dell'altro; i non letti della conversazione tornano a zero. */
    markConversationRead: build.mutation<void, string>({
      query: (conversationId) => ({ url: `/api/chats/${encodeURIComponent(conversationId)}/read`, method: 'PATCH' }),
      onQueryStarted: async (conversationId, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled
        } catch {
          return // la lettura non è riuscita: i non letti restano com'erano
        }
        dispatch(
          chatApi.util.updateQueryData('getConversations', undefined, (conversations) =>
            withConversationRead(conversations, conversationId),
          ),
        )
      },
    }),

    /** `POST /api/chats` (200): trova o crea la conversazione con un amico; fra non amici dà 403 `NOT_FRIENDS`. */
    openConversation: build.mutation<ConversationResponse, string>({
      query: (recipientId) => ({ url: '/api/chats', method: 'POST', body: { recipientId } }),
      invalidatesTags: ['Chat'],
    }),
  }),
})

export const {
  useGetConversationsQuery,
  useGetMessagesQuery,
  useLazyGetOlderMessagesQuery,
  useMarkConversationReadMutation,
  useOpenConversationMutation,
} = chatApi

/**
 * Applica a elenco e badge un messaggio arrivato su `/user/queue/messages`, senza chiamare il server (il messaggio è già
 * salvato: progettazione, sezione 7.6). Se la conversazione non è nell'elenco (nuova, creata da una candidatura o da un
 * contatto) l'elenco si ricarica.
 */
export function receiveMessage(
  dispatch: AppDispatch,
  message: ChatMessageResponse,
  options: { myId: string; isOpen: boolean },
) {
  let unknown = false
  dispatch(
    chatApi.util.updateQueryData('getConversations', undefined, (conversations) => {
      const next = withIncomingMessage(conversations, message, options)
      if (next === null) {
        unknown = true
        return
      }
      return next
    }),
  )
  if (unknown) dispatch(chatApi.util.invalidateTags(['Chat']))
}

/**
 * Aggiunge allo storico aperto un messaggio arrivato su `/user/queue/messages`, una volta sola anche se arriva due volte
 * (Review Focus 8 del piano). Restituisce `true` se il messaggio era già nello storico (consegna doppia). Senza uno
 * storico in cache non fa nulla: la prima lettura lo porterà.
 */
export function receiveHistoryMessage(dispatch: AppDispatch, message: ChatMessageResponse): boolean {
  let duplicate = false
  dispatch(
    chatApi.util.updateQueryData('getMessages', message.conversationId, (history) => {
      duplicate = history.messages.some((known) => known.id === message.id)
      return withHistoryMessage(history, message)
    }),
  )
  return duplicate
}

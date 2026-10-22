import { api } from '@/lib/api/apiSlice'
import type { PageResponse } from '@/types/common'
import type {
  FriendshipListArgs,
  FriendshipResponse,
  UserSearchArgs,
  UserSearchResult,
} from '@/types/friends'

/** Etichette di cache delle ricerche: ogni risultato porta la propria, più quella dell'elenco intero. */
const searchTags = (result?: PageResponse<UserSearchResult>) => [
  { type: 'UserSearch' as const, id: 'LIST' },
  ...(result?.content ?? []).map(({ id }) => ({ type: 'UserSearch' as const, id })),
]

/** Richieste che la campanella chiede in una volta: quante ne mostra da tablet in su (sotto i 768 px ne mostra 5). */
export const BELL_PAGE_SIZE = 10

/**
 * Cosa si rilegge dopo ogni azione sulle amicizie: gli elenchi, il conteggio e il pannello della campanella e i risultati
 * di ricerca, che mostrano lo stato dell'amicizia (decisione 78: nessun polling, si ricarica dopo ogni azione).
 */
export const FRIENDSHIP_TAGS = ['Friendship', 'FriendRequests', 'UserSearch'] as const

/** Endpoint di ricerca utenti e amicizie (progettazione, sezioni 6.5 e 6.14). */
export const friendsApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * `GET /api/users/search`: persone per nome (2–50 caratteri, già puliti), con il loro stato di amicizia. Una pagina
     * per voce di cache: dopo un'azione si rileggono tutte le pagine aperte, senza accodamenti che duplicano.
     */
    searchUsers: build.query<PageResponse<UserSearchResult>, UserSearchArgs>({
      query: ({ q, page }) => ({ url: '/api/users/search', params: { q, page } }),
      providesTags: (result) => searchTags(result),
    }),

    /**
     * `GET /api/friendships?type=`: amici, richieste ricevute o inviate, dalla più recente. Una pagina per voce di cache,
     * come la ricerca: dopo un'azione si rileggono tutte le pagine aperte.
     */
    getFriendships: build.query<PageResponse<FriendshipResponse>, FriendshipListArgs>({
      query: ({ type, page }) => ({ url: '/api/friendships', params: { type, page } }),
      providesTags: (result, _error, { type }) => [
        { type: 'Friendship' as const, id: type },
        ...(result?.content ?? []).map(({ id }) => ({ type: 'Friendship' as const, id })),
      ],
    }),

    /**
     * `GET /api/friendships?type=INCOMING&size=10`: le richieste ricevute più recenti per la campanella. Una sola
     * chiamata dà il numero (`totalElements`) e le righe del pannello (il piano diceva `size=1` solo per il numero).
     */
    getPendingRequests: build.query<PageResponse<FriendshipResponse>, void>({
      query: () => ({ url: '/api/friendships', params: { type: 'INCOMING', page: 0, size: BELL_PAGE_SIZE } }),
      providesTags: ['FriendRequests'],
    }),

    /** `POST /api/friendships` (201): chiede l'amicizia alla persona; il limite `FRIEND_REQUESTS` conta anche i fallimenti. */
    requestFriendship: build.mutation<FriendshipResponse, string>({
      query: (userId) => ({ url: '/api/friendships', method: 'POST', body: { userId } }),
      invalidatesTags: [...FRIENDSHIP_TAGS],
    }),

    /** `POST /api/friendships/{id}/accept` (200): solo il destinatario. */
    acceptFriendship: build.mutation<FriendshipResponse, string>({
      query: (id) => ({ url: `/api/friendships/${encodeURIComponent(id)}/accept`, method: 'POST' }),
      invalidatesTags: [...FRIENDSHIP_TAGS],
    }),

    /** `POST /api/friendships/{id}/decline` (204): solo il destinatario; chi l'ha inviata non riceve nessun avviso. */
    declineFriendship: build.mutation<void, string>({
      query: (id) => ({ url: `/api/friendships/${encodeURIComponent(id)}/decline`, method: 'POST' }),
      invalidatesTags: [...FRIENDSHIP_TAGS],
    }),

    /** `POST /api/friendships/{id}/cancel` (204): solo chi ha inviato la richiesta. */
    cancelFriendship: build.mutation<void, string>({
      query: (id) => ({ url: `/api/friendships/${encodeURIComponent(id)}/cancel`, method: 'POST' }),
      invalidatesTags: [...FRIENDSHIP_TAGS],
    }),

    /** `DELETE /api/friendships/{id}` (204): uno dei due amici rimuove l'amicizia. */
    removeFriendship: build.mutation<void, string>({
      query: (id) => ({ url: `/api/friendships/${encodeURIComponent(id)}`, method: 'DELETE' }),
      invalidatesTags: [...FRIENDSHIP_TAGS],
    }),
  }),
})

export const {
  useSearchUsersQuery,
  useGetFriendshipsQuery,
  useGetPendingRequestsQuery,
  useRequestFriendshipMutation,
  useAcceptFriendshipMutation,
  useDeclineFriendshipMutation,
  useCancelFriendshipMutation,
  useRemoveFriendshipMutation,
} = friendsApi

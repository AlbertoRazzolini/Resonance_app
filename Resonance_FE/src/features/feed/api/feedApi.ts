import type { RootState } from '@/app/store'
import { api } from '@/lib/api/apiSlice'
import type { PageResponse } from '@/types/common'
import type { CreateFeedPostRequest, FeedParams, FeedPostResponse, LikeStatusResponse } from '@/types/feed'

/** Argomenti di un like: il post e lo stato che si vuole (`true` = «Mi piace», `false` = toglierlo). */
export type LikeArgs = { id: string; liked: boolean }

/** Etichette di cache dei post: ogni voce dell'elenco porta la propria, più quella dell'elenco intero. */
const postTags = (list: 'LIST' | 'MINE', result?: PageResponse<FeedPostResponse>) => [
  { type: 'FeedPost' as const, id: list },
  ...(result?.content ?? []).map(({ id }) => ({ type: 'FeedPost' as const, id })),
]

/** Endpoint del feed (progettazione, sezione 6.8): elenco pubblico, i miei post, creazione, cancellazione e like. */
export const feedApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * `GET /api/feed-posts`: dal più recente, accesso libero. Con il filtro geografico `lat`, `lng` e `radiusKm`
     * vanno insieme (decisione 61). Una pagina per voce di cache, come le schede dell'area personale: dopo una
     * creazione, una cancellazione o un like si rileggono tutte le pagine aperte, senza accodamenti che duplicano.
     */
    getFeed: build.query<PageResponse<FeedPostResponse>, FeedParams>({
      query: ({ lat, lng, radiusKm, page }) => ({
        url: '/api/feed-posts',
        params: { lat, lng, radiusKm, page },
      }),
      providesTags: (result) => postTags('LIST', result),
    }),

    /** `GET /api/feed-posts/mine`: i miei post non nascosti, dal più recente; `distanceKm` è sempre nullo (decisione 77). */
    getMyPosts: build.query<PageResponse<FeedPostResponse>, number>({
      query: (page) => ({ url: '/api/feed-posts/mine', params: { page } }),
      providesTags: (result) => postTags('MINE', result),
    }),

    /** `POST /api/feed-posts` (201): il post nuovo cambia l'elenco intero e la scheda «Post». */
    createPost: build.mutation<FeedPostResponse, CreateFeedPostRequest>({
      query: (body) => ({ url: '/api/feed-posts', method: 'POST', body }),
      invalidatesTags: [
        { type: 'FeedPost', id: 'LIST' },
        { type: 'FeedPost', id: 'MINE' },
      ],
    }),

    /** `DELETE /api/feed-posts/{id}` (204): solo il proprietario; il post sparisce da elenco e scheda «Post». */
    deletePost: build.mutation<void, string>({
      query: (id) => ({ url: `/api/feed-posts/${encodeURIComponent(id)}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'FeedPost', id },
        { type: 'FeedPost', id: 'LIST' },
        { type: 'FeedPost', id: 'MINE' },
      ],
    }),

    /**
     * `PUT` o `DELETE /api/feed-posts/{id}/like`, idempotenti: 200 con lo stato vero. Ottimistico: il post cambia
     * subito in tutte le voci di cache dove compare; a risposta arrivata prende i numeri del server, con un errore
     * tutto torna com'era (piano frontend, FE-07). Nessuna invalidazione: rileggere l'elenco farebbe sfarfallare.
     */
    likePost: build.mutation<LikeStatusResponse, LikeArgs>({
      query: ({ id, liked }) => ({
        url: `/api/feed-posts/${encodeURIComponent(id)}/like`,
        method: liked ? 'PUT' : 'DELETE',
      }),
      async onQueryStarted({ id, liked }, { dispatch, getState, queryFulfilled }) {
        const apply = (recipe: (post: FeedPostResponse) => void) => {
          const patches: { undo: () => void }[] = []
          const state = getState() as RootState
          for (const arg of feedApi.util.selectCachedArgsForQuery(state, 'getFeed')) {
            patches.push(
              dispatch(feedApi.util.updateQueryData('getFeed', arg, (page) => page.content.filter((p) => p.id === id).forEach(recipe))),
            )
          }
          for (const arg of feedApi.util.selectCachedArgsForQuery(state, 'getMyPosts')) {
            patches.push(
              dispatch(feedApi.util.updateQueryData('getMyPosts', arg, (page) => page.content.filter((p) => p.id === id).forEach(recipe))),
            )
          }
          return patches
        }

        // Un like nuovo somma uno, un like tolto sottrae uno; se il post era già nello stato voluto non cambia niente
        const patches = apply((post) => {
          if (post.likedByMe === liked) return
          post.likedByMe = liked
          post.likesCount += liked ? 1 : -1
        })
        try {
          const { data } = await queryFulfilled
          apply((post) => {
            post.likedByMe = data.likedByMe
            post.likesCount = data.likesCount
          })
        } catch {
          patches.forEach((patch) => patch.undo())
        }
      },
    }),
  }),
})

export const {
  useCreatePostMutation,
  useDeletePostMutation,
  useGetFeedQuery,
  useGetMyPostsQuery,
  useLikePostMutation,
} = feedApi

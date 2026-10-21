import { api } from '@/lib/api/apiSlice'
import { errorCode } from '@/lib/api/baseQuery'
import type { ApplicationResponse, ApplyArgs, CollabPostResponse, CreateCollabPostRequest } from '@/types/collab'
import type { PageResponse } from '@/types/common'

/** Argomenti di una cancellazione: l'annuncio e il motivo facoltativo (massimo 500 caratteri). */
export type DeleteCollabArgs = { id: string; reason?: string }

/** Vero per un 404 con codice `NOT_FOUND`: annuncio inesistente o nascosto (progettazione, sezione 6.7). */
export function isCollabNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { status, data } = error as { status?: unknown; data?: unknown }
  return status === 404 && errorCode(data) === 'NOT_FOUND'
}

/** Etichette di cache degli annunci: ogni voce dell'elenco porta la propria, più quella dell'elenco intero. */
const postTags = (list: 'LIST' | 'MINE', result?: PageResponse<CollabPostResponse>) => [
  { type: 'CollabPost' as const, id: list },
  ...(result?.content ?? []).map(({ id }) => ({ type: 'CollabPost' as const, id })),
]

/** Etichette da invalidare quando un annuncio cambia o sparisce: la voce, la bacheca e la scheda «Annunci». */
const changedTags = (id: string) => [
  { type: 'CollabPost' as const, id },
  { type: 'CollabPost' as const, id: 'LIST' },
  { type: 'CollabPost' as const, id: 'MINE' },
]

/** Endpoint della bacheca collab (progettazione, sezione 6.7): elenchi, dettaglio, creazione, chiusura, cancellazione e candidatura. */
export const collabApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * `GET /api/collab-posts`: annunci aperti e non nascosti, dal più recente, accesso libero. Una pagina per voce di
     * cache: dopo una chiusura o una cancellazione si rileggono tutte le pagine aperte, senza accodamenti che duplicano.
     */
    getCollabPosts: build.query<PageResponse<CollabPostResponse>, number>({
      query: (page) => ({ url: '/api/collab-posts', params: { page } }),
      providesTags: (result) => postTags('LIST', result),
    }),

    /** `GET /api/collab-posts/mine`: i miei annunci, chiusi compresi, dal più recente (decisione 77). */
    getMyCollabPosts: build.query<PageResponse<CollabPostResponse>, number>({
      query: (page) => ({ url: '/api/collab-posts/mine', params: { page } }),
      providesTags: (result) => postTags('MINE', result),
    }),

    /** `GET /api/collab-posts/{id}`: anche un annuncio chiuso; uno nascosto dà 404. */
    getCollabPost: build.query<CollabPostResponse, string>({
      query: (id) => `/api/collab-posts/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: 'CollabPost', id }],
    }),

    /** `POST /api/collab-posts` (solo MUSICIAN, 201): l'annuncio nuovo cambia la bacheca e la scheda «Annunci». */
    createCollabPost: build.mutation<CollabPostResponse, CreateCollabPostRequest>({
      query: (body) => ({ url: '/api/collab-posts', method: 'POST', body }),
      invalidatesTags: [
        { type: 'CollabPost', id: 'LIST' },
        { type: 'CollabPost', id: 'MINE' },
      ],
    }),

    /** `PATCH /api/collab-posts/{id}/close` (200, idempotente): risponde con l'annuncio chiuso (decisione 60). */
    closeCollabPost: build.mutation<CollabPostResponse, string>({
      query: (id) => ({ url: `/api/collab-posts/${encodeURIComponent(id)}/close`, method: 'PATCH' }),
      invalidatesTags: (_result, _error, id) => changedTags(id),
    }),

    /** `DELETE /api/collab-posts/{id}` (204): cancellazione del proprietario; il motivo va nel body solo se c'è. */
    deleteCollabPost: build.mutation<void, DeleteCollabArgs>({
      query: ({ id, reason }) => ({
        url: `/api/collab-posts/${encodeURIComponent(id)}`,
        method: 'DELETE',
        ...(reason && { body: { reason } }),
      }),
      invalidatesTags: (_result, _error, { id }) => changedTags(id),
    }),

    /**
     * `POST /api/collab-posts/{id}/applications` (201): la candidatura è un messaggio nella conversazione con l'autore
     * (decisione 24). Nessuna invalidazione: nessun annuncio cambia.
     */
    applyToCollabPost: build.mutation<ApplicationResponse, ApplyArgs>({
      query: ({ id, message }) => ({
        url: `/api/collab-posts/${encodeURIComponent(id)}/applications`,
        method: 'POST',
        body: { message },
      }),
    }),
  }),
})

export const {
  useApplyToCollabPostMutation,
  useCloseCollabPostMutation,
  useCreateCollabPostMutation,
  useDeleteCollabPostMutation,
  useGetCollabPostQuery,
  useGetCollabPostsQuery,
  useGetMyCollabPostsQuery,
} = collabApi

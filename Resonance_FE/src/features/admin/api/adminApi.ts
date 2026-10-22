import { api } from '@/lib/api/apiSlice'
import type {
  AdminUserResponse,
  AdminUsersParams,
  HiddenContentParams,
  HiddenContentResponse,
  HideContentArgs,
  RestoreContentArgs,
  SuspendUserRequest,
} from '@/types/admin'
import type { PageResponse } from '@/types/common'
import { contentTags } from '../contentTypes'

/** Argomenti della sospensione: l'utente e il corpo della richiesta. */
export type SuspendUserArgs = { id: string; body: SuspendUserRequest }

/** Rilegge l'elenco utenti dopo un'azione su un utente: la riga e le pagine aperte si aggiornano (decisione 78: niente polling). */
const userTags = (id: string) => [
  { type: 'AdminUser' as const, id },
  { type: 'AdminUser' as const, id: 'LIST' },
]

/** Endpoint dell'area di moderazione (progettazione, sezione 6.10): elenco utenti, sospensione, ruolo ADMIN e contenuti nascosti. */
export const adminApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * `GET /api/admin/users`: utenti dal più recente, con ricerca su email e nome e filtro sullo stato salvato. Una
     * pagina per voce di cache; ogni riga porta la propria etichetta, così l'azione su un utente rilegge l'elenco.
     */
    getAdminUsers: build.query<PageResponse<AdminUserResponse>, AdminUsersParams>({
      query: ({ search, status, page }) => ({ url: '/api/admin/users', params: { search, status, page } }),
      providesTags: (result) => [
        { type: 'AdminUser' as const, id: 'LIST' },
        ...(result?.content ?? []).map(({ id }) => ({ type: 'AdminUser' as const, id })),
      ],
    }),

    /** `POST /api/admin/users/{id}/suspension` (200, `AdminUserResponse`): sospende l'utente e ne chiude le sessioni. */
    suspendUser: build.mutation<AdminUserResponse, SuspendUserArgs>({
      query: ({ id, body }) => ({ url: `/api/admin/users/${encodeURIComponent(id)}/suspension`, method: 'POST', body }),
      invalidatesTags: (_result, _error, { id }) => userTags(id),
    }),

    /** `DELETE /api/admin/users/{id}/suspension` (200, `AdminUserResponse`): riattivazione anticipata, idempotente. */
    reactivateUser: build.mutation<AdminUserResponse, string>({
      query: (id) => ({ url: `/api/admin/users/${encodeURIComponent(id)}/suspension`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => userTags(id),
    }),

    /** `POST /api/superadmin/users/{id}/admin` (200, `AdminUserResponse`): nomina ADMIN, solo SUPERADMIN, idempotente. */
    grantAdmin: build.mutation<AdminUserResponse, string>({
      query: (id) => ({ url: `/api/superadmin/users/${encodeURIComponent(id)}/admin`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => userTags(id),
    }),

    /** `DELETE /api/superadmin/users/{id}/admin` (200, `AdminUserResponse`): revoca ADMIN, solo SUPERADMIN, idempotente. */
    revokeAdmin: build.mutation<AdminUserResponse, string>({
      query: (id) => ({ url: `/api/superadmin/users/${encodeURIComponent(id)}/admin`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => userTags(id),
    }),

    /** `GET /api/admin/moderation/{type}/hidden`: i contenuti nascosti di un tipo, dal più recente (sezione 5.7). */
    getHiddenContent: build.query<PageResponse<HiddenContentResponse>, HiddenContentParams>({
      query: ({ type, page }) => ({ url: `/api/admin/moderation/${type}/hidden`, params: { page } }),
      providesTags: (_result, _error, { type }) => [{ type: 'HiddenContent' as const, id: type }],
    }),

    /** `POST /api/admin/moderation/{type}/{id}/hide` (204): nasconde il contenuto con un motivo di almeno 3 caratteri. */
    hideContent: build.mutation<void, HideContentArgs>({
      query: ({ type, id, reason }) => ({
        url: `/api/admin/moderation/${type}/${encodeURIComponent(id)}/hide`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (_result, _error, { type, id }) => contentTags(type, id),
    }),

    /** `POST /api/admin/moderation/{type}/{id}/restore` (204): ripristina un contenuto nascosto da un admin. */
    restoreContent: build.mutation<void, RestoreContentArgs>({
      query: ({ type, id }) => ({
        url: `/api/admin/moderation/${type}/${encodeURIComponent(id)}/restore`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { type, id }) => contentTags(type, id),
    }),
  }),
})

export const {
  useGetAdminUsersQuery,
  useGetHiddenContentQuery,
  useGrantAdminMutation,
  useHideContentMutation,
  useReactivateUserMutation,
  useRestoreContentMutation,
  useRevokeAdminMutation,
  useSuspendUserMutation,
} = adminApi

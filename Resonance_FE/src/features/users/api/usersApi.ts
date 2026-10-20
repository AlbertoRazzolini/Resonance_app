import { userUpdated } from '@/features/auth/authSlice'
import { api } from '@/lib/api/apiSlice'
import type { MeResponse, PublicUserResponse, UpdateProfileRequest } from '@/types/users'

/** Ruolo che l'utente può attivare da solo (progettazione, sezione 5.3): il percorso dell'endpoint. */
export type SelfServiceRole = 'musician' | 'host'

/** Endpoint degli utenti (progettazione, sezione 6.5); le risposte con il profilo aggiornano la sessione. */
export const usersApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * `PATCH /api/users/me`: il corpo ha solo i campi cambiati (decisione 31). La risposta è il profilo intero e
     * sostituisce quello della sessione, così barra e menu si allineano subito.
     */
    updateProfile: build.mutation<MeResponse, UpdateProfileRequest>({
      query: (body) => ({ url: '/api/users/me', method: 'PATCH', body }),
      invalidatesTags: (me) => (me ? [{ type: 'PublicUser', id: me.id }] : []),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(userUpdated(data))
        } catch {
          // Il messaggio d'errore lo mostra il form
        }
      },
    }),

    /** `DELETE /api/users/me/location` (idempotente): smette di condividere la posizione (decisione 30). */
    removeLocation: build.mutation<MeResponse, void>({
      query: () => ({ url: '/api/users/me/location', method: 'DELETE' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(userUpdated(data))
        } catch {
          // Il messaggio d'errore lo mostra la pagina
        }
      },
    }),

    /** Attivazione di MUSICIAN o HOST, idempotente (decisione 53): la risposta ha i ruoli aggiornati. */
    activateRole: build.mutation<MeResponse, SelfServiceRole>({
      query: (role) => ({ url: `/api/users/me/roles/${role}`, method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(userUpdated(data))
        } catch {
          // Il messaggio d'errore lo mostra la pagina
        }
      },
    }),

    /** Profilo pubblico di un utente (accesso libero); un utente non verificato o inesistente dà 404 `NOT_FOUND`. */
    getPublicUser: build.query<PublicUserResponse, string>({
      query: (id) => `/api/users/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: 'PublicUser', id }],
    }),
  }),
})

export const {
  useActivateRoleMutation,
  useGetPublicUserQuery,
  useRemoveLocationMutation,
  useUpdateProfileMutation,
} = usersApi

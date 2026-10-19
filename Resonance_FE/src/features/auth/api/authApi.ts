import { api } from '@/lib/api/apiSlice'
import { CSRF_HEADERS } from '@/lib/api/baseQuery'
import { noticeShown } from '@/lib/notices/noticeSlice'
import type { LoginRequest, LoginResponse } from '@/types/users'
import { sessionEnded, sessionStarted } from '../authSlice'

/** Endpoint di autenticazione; le card successive aggiungono registrazione, verifica e password. */
export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Login (progettazione, sezione 4.7): la sessione si apre solo con la risposta del server. Gli errori
     * (credenziali, email non verificata, sospensione, troppi tentativi) li legge la pagina dallo stato della
     * mutazione; nessun refresh parte, perché `/api/auth/*` non lo attiva mai (decisione 82).
     */
    login: build.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({ url: '/api/auth/login', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(sessionStarted(data))
        } catch {
          // Il messaggio d'errore lo mostra la pagina
        }
      },
    }),

    /**
     * Logout: `DELETE /api/auth/refresh` (progettazione, decisione 11). La sessione si chiude comunque, anche se
     * il server non risponde, ma in quel caso un avviso dice che il cookie può riaprirla al prossimo caricamento.
     * `sessionEnded` svuota anche la cache di `api`.
     */
    logout: build.mutation<void, void>({
      query: () => ({ url: '/api/auth/refresh', method: 'DELETE', headers: CSRF_HEADERS }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        let reached = true
        try {
          await queryFulfilled
        } catch {
          reached = false
        }
        dispatch(sessionEnded())
        if (!reached) dispatch(noticeShown('logoutIncomplete'))
      },
    }),
  }),
})

export const { useLoginMutation, useLogoutMutation } = authApi

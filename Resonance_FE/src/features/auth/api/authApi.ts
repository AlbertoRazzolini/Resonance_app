import { api } from '@/lib/api/apiSlice'
import { CSRF_HEADERS } from '@/lib/api/baseQuery'
import { noticeShown } from '@/lib/notices/noticeSlice'
import { sessionEnded } from '../authSlice'

/** Endpoint di autenticazione; le card successive aggiungono login, registrazione, verifica e password. */
export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
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

export const { useLogoutMutation } = authApi

import { api } from '@/lib/api/apiSlice'
import { CSRF_HEADERS } from '@/lib/api/baseQuery'
import { noticeShown } from '@/lib/notices/noticeSlice'
import type {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ResendCodeRequest,
  ResetPasswordRequest,
  VerifyRequest,
} from '@/types/users'
import { sessionEnded, sessionStarted } from '../authSlice'

/** Endpoint di autenticazione; le card successive aggiungono registrazione, verifica e password. */
export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Registrazione (progettazione, sezione 4.4): risponde 201 con la sola email e non apre la sessione, perché serve
     * la verifica con il codice. Gli errori li legge la pagina dallo stato della mutazione.
     */
    register: build.mutation<RegisterResponse, RegisterRequest>({
      query: (body) => ({ url: '/api/auth/register', method: 'POST', body }),
    }),

    /**
     * Verifica dell'email (progettazione, sezione 4.5): con il codice e la password della registrazione il backend
     * risponde come un login, e la sessione si apre con la sua risposta. Gli errori li legge la pagina.
     */
    verify: build.mutation<LoginResponse, VerifyRequest>({
      query: (body) => ({ url: '/api/auth/verify', method: 'POST', body }),
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
     * Reinvio del codice (sezione 4.6): 204 sempre, anche per email sconosciute (non rivela chi è registrato); al
     * massimo un invio ogni 60 secondi e 5 in 24 ore (429 `TOO_MANY_REQUESTS`).
     */
    resendCode: build.mutation<void, ResendCodeRequest>({
      query: (body) => ({ url: '/api/auth/resend-code', method: 'POST', body }),
    }),
    /**
     * Password dimenticata (sezione 4.10): 204 sempre, per qualunque email; il codice parte solo per un utente
     * verificato e attivo, con gli stessi limiti del reinvio (decisione 51: la risposta non rivela chi è registrato).
     */
    forgotPassword: build.mutation<void, ForgotPasswordRequest>({
      query: (body) => ({ url: '/api/auth/password/forgot', method: 'POST', body }),
    }),
    /**
     * Reset della password (sezione 4.10): 204. Il backend revoca tutti i refresh token e cancella il cookie, quindi
     * qui si chiude anche la sessione dell'app (`sessionEnded` svuota pure la cache). Non apre una nuova sessione.
     */
    resetPassword: build.mutation<void, ResetPasswordRequest>({
      query: (body) => ({ url: '/api/auth/password/reset', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
          dispatch(sessionEnded())
        } catch {
          // Il messaggio d'errore lo mostra la pagina, e la sessione resta com'è
        }
      },
    }),
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

export const {
  useForgotPasswordMutation,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
  useResendCodeMutation,
  useResetPasswordMutation,
  useVerifyMutation,
} = authApi

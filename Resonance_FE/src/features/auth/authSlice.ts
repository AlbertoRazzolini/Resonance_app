import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { LoginResponse, MeResponse, Role, SuspensionDetails } from '@/types/users'

/**
 * Stato della sessione. `unknown` solo finché l'avvio non ha provato il refresh (progettazione, sezione 4.13);
 * l'access token vive solo qui, mai in localStorage o sessionStorage (sezione 4.1).
 */
export type AuthState = {
  status: 'unknown' | 'authenticated' | 'anonymous'
  accessToken: string | null
  accessTokenExpiresAt: string | null
  user: MeResponse | null
  suspension: SuspensionDetails | null
}

const initialState: AuthState = {
  status: 'unknown',
  accessToken: null,
  accessTokenExpiresAt: null,
  user: null,
  suspension: null,
}

/** Perché la sessione si chiude: con `suspension` l'account è stato sospeso e la schermata mostra i dettagli. */
export type SessionEndReason = { suspension?: SuspensionDetails }

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Login, verifica o primo refresh dell'avvio: apre la sessione. */
    sessionStarted(state, action: PayloadAction<LoginResponse>) {
      state.status = 'authenticated'
      state.accessToken = action.payload.accessToken
      state.accessTokenExpiresAt = action.payload.accessTokenExpiresAt
      state.user = action.payload.user
      state.suspension = null
    },
    /** Refresh riuscito a sessione aperta: nuovo token e profilo riletto dal backend. */
    tokenRefreshed(state, action: PayloadAction<LoginResponse>) {
      state.accessToken = action.payload.accessToken
      state.accessTokenExpiresAt = action.payload.accessTokenExpiresAt
      state.user = action.payload.user
    },
    /** Profilo modificato dall'utente (PATCH /me, nuovo ruolo, posizione). */
    userUpdated(state, action: PayloadAction<MeResponse>) {
      state.user = action.payload
    },
    /** Logout, refresh fallito o sospensione: nessun dato dell'utente resta in memoria. */
    sessionEnded(_state, action: PayloadAction<SessionEndReason | undefined>) {
      return {
        ...initialState,
        status: 'anonymous',
        suspension: action.payload?.suspension ?? null,
      }
    },
  },
})

export const { sessionStarted, tokenRefreshed, userUpdated, sessionEnded } = authSlice.actions
export const authReducer = authSlice.reducer

/** Il reducer `auth` come lo monta lo store: i selettori dipendono solo da questa parte. */
type WithAuth = { auth: AuthState }

export const selectCurrentUser = (state: WithAuth) => state.auth.user

/**
 * Solo per mostrare o nascondere l'interfaccia (la protezione vera è nel backend). Rispecchia la
 * `RoleHierarchy` del backend: SUPERADMIN vale anche come ADMIN (sezione 5.1).
 */
export const selectHasRole = (role: Role) => (state: WithAuth) => {
  const roles = state.auth.user?.roles ?? []
  return roles.includes(role) || (role === 'ADMIN' && roles.includes('SUPERADMIN'))
}

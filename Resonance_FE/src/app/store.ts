import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit'
import { authReducer, sessionEnded } from '@/features/auth/authSlice'
import { api } from '@/lib/api/apiSlice'
import { noticeReducer } from '@/lib/notices/noticeSlice'

/**
 * Crea uno store nuovo: l'app ne usa uno solo (`store`), i test uno per prova. Alla chiusura della sessione
 * (logout, refresh rifiutato, sospensione) la cache di `api` si svuota, così nessun dato dell'utente resta in memoria.
 */
export function makeStore() {
  const listener = createListenerMiddleware()
  listener.startListening({
    actionCreator: sessionEnded,
    effect: (_action, listenerApi) => {
      listenerApi.dispatch(api.util.resetApiState())
    },
  })
  return configureStore({
    reducer: { auth: authReducer, notice: noticeReducer, [api.reducerPath]: api.reducer },
    middleware: (getDefault) => getDefault().prepend(listener.middleware).concat(api.middleware),
  })
}

export const store = makeStore()

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']

import { configureStore } from '@reduxjs/toolkit'

/**
 * Store Redux dell'app. Per ora senza dati: FE-02 aggiunge `api` (RTK Query) e `authSlice`, le card
 * successive `notificationsSlice`.
 */
export const store = configureStore({
  reducer: (state: Record<string, never> = {}) => state,
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import { sessionEnded } from '@/features/auth/authSlice'
import type { LiveNotification } from '@/types/chat'

/**
 * Toast di una notifica live: l'`id` è quello della notifica salvata, oppure uno nuovo per un messaggio (che non si
 * salva). La lettura non sta qui: le notifiche salvate vivono nella cache di RTK Query (decisione 97).
 */
export type ToastNotification = LiveNotification & { id: string }

type NotificationsState = {
  /** Toast in vista, i più recenti per primi. */
  toasts: ToastNotification[]
}

/** Toast mostrati insieme: i più recenti (scelta dello studente, FE-09b). */
const MAX_TOASTS = 3

const initialState: NotificationsState = { toasts: [] }

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    /**
     * Notifica arrivata su `/user/queue/notifications`: va a un toast. Di una conversazione di messaggi resta un solo
     * toast, quello dell'ultimo messaggio; una notifica salvata arrivata due volte ne ha uno solo.
     */
    received: {
      reducer(state, action: PayloadAction<ToastNotification>) {
        const incoming = action.payload
        state.toasts = state.toasts.filter((toast) => {
          if (toast.id === incoming.id) return false
          return !(incoming.type === 'NEW_MESSAGE' && toast.type === 'NEW_MESSAGE' && toast.targetId === incoming.targetId)
        })
        state.toasts = [incoming, ...state.toasts].slice(0, MAX_TOASTS)
      },
      prepare: (notification: LiveNotification) => ({
        payload: { ...notification, id: notification.id ?? nanoid() },
      }),
    },
    /** Il toast si chiude (da solo o con la X): la notifica resta nella campanella. */
    toastDismissed(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload)
    },
  },
  // Uscita, refresh rifiutato o sospensione: nessun dato dell'utente resta in memoria
  extraReducers: (builder) => {
    builder.addCase(sessionEnded, () => initialState)
  },
})

export const { received, toastDismissed } = notificationsSlice.actions
export const notificationsReducer = notificationsSlice.reducer

/** I toast in vista, dal più recente. */
export const selectToasts = (state: { notifications: NotificationsState }) => state.notifications.toasts

import { createSelector, createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import { sessionEnded } from '@/features/auth/authSlice'
import type { LiveNotification } from '@/types/chat'

/** Notifica live della sessione: `read` lo cambia solo l'utente (clic su una voce o «Segna come lette»). */
export type SessionNotification = LiveNotification & { id: string; read: boolean }

type NotificationsState = {
  /** Le più recenti per prime. */
  items: SessionNotification[]
  /** Id dei toast in vista, i più recenti per primi. */
  toastIds: string[]
}

/** Notifiche tenute per la campanella: solo in memoria, il resto esce (progettazione, sezione 6.13: nessuno storico). */
const MAX_ITEMS = 20
/** Toast mostrati insieme: i più recenti (scelta dello studente, FE-09b). */
const MAX_TOASTS = 3

const initialState: NotificationsState = { items: [], toastIds: [] }

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    /**
     * Notifica arrivata su `/user/queue/notifications`: va alla campanella e a un toast. Di una conversazione di
     * messaggi resta un solo toast, quello dell'ultimo messaggio.
     */
    received: {
      reducer(state, action: PayloadAction<SessionNotification>) {
        const incoming = action.payload
        if (incoming.type === 'NEW_MESSAGE') {
          const sameConversation = state.items
            .filter((item) => item.type === 'NEW_MESSAGE' && item.targetId === incoming.targetId)
            .map((item) => item.id)
          state.toastIds = state.toastIds.filter((id) => !sameConversation.includes(id))
        }
        state.items = [incoming, ...state.items].slice(0, MAX_ITEMS)
        state.toastIds = [incoming.id, ...state.toastIds].slice(0, MAX_TOASTS)
      },
      prepare: (notification: LiveNotification) => ({
        payload: { ...notification, id: nanoid(), read: false },
      }),
    },
    /** Il toast si chiude (da solo o con la X): la notifica resta nella campanella. */
    toastDismissed(state, action: PayloadAction<string>) {
      state.toastIds = state.toastIds.filter((id) => id !== action.payload)
    },
    /** Clic su una voce: quella notifica è letta. */
    markRead(state, action: PayloadAction<string>) {
      const item = state.items.find((candidate) => candidate.id === action.payload)
      if (item) item.read = true
    },
    /** «Segna come lette»: tutte le notifiche della sessione. */
    markAllRead(state) {
      state.items.forEach((item) => {
        item.read = true
      })
    },
  },
  // Uscita, refresh rifiutato o sospensione: nessun dato dell'utente resta in memoria
  extraReducers: (builder) => {
    builder.addCase(sessionEnded, () => initialState)
  },
})

export const { received, toastDismissed, markRead, markAllRead } = notificationsSlice.actions
export const notificationsReducer = notificationsSlice.reducer

type WithNotifications = { notifications: NotificationsState }

export const selectNotifications = (state: WithNotifications) => state.notifications.items

/** I toast in vista, dal più recente. */
export const selectToasts = createSelector(
  [(state: WithNotifications) => state.notifications.items, (state: WithNotifications) => state.notifications.toastIds],
  (items, toastIds) => toastIds.flatMap((id) => items.find((item) => item.id === id) ?? []),
)

/** Notifiche della sessione non ancora lette. */
export const selectUnreadNotificationCount = (state: WithNotifications) =>
  state.notifications.items.filter((item) => !item.read).length

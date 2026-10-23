import type { AppDispatch, RootState } from '@/app/store'
import { api } from '@/lib/api/apiSlice'
import type { LiveNotification } from '@/types/chat'
import type { PageResponse } from '@/types/common'
import type { NotificationResponse, UnreadCountResponse } from '@/types/notifications'

/** Notifiche per pagina: «Carica altri» ne aggiunge altre 10 (scelta dello studente, FE-13). */
export const NOTIFICATIONS_PAGE_SIZE = 10

/** Endpoint delle notifiche salvate (progettazione, sezione 6.15; decisione 97). */
export const notificationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * `GET /api/notifications`: dalla più recente. Una pagina per voce di cache, come gli altri elenchi: dopo
     * un'invalidazione si rileggono tutte le pagine aperte, senza accodamenti che duplicano.
     */
    getNotifications: build.query<PageResponse<NotificationResponse>, number>({
      query: (page) => ({ url: '/api/notifications', params: { page, size: NOTIFICATIONS_PAGE_SIZE } }),
      providesTags: ['Notification'],
    }),

    /** `GET /api/notifications/unread-count`: il numero sull'icona, che scende solo segnando lette le notifiche. */
    getUnreadCount: build.query<number, void>({
      query: () => ({ url: '/api/notifications/unread-count' }),
      transformResponse: (response: UnreadCountResponse) => response.count,
      providesTags: ['Notification'],
    }),

    /**
     * `POST /api/notifications/{id}/read` (204, idempotente). A risposta arrivata la riga diventa letta e il numero scende
     * di uno, senza richiamare il server; se la notifica non è in nessuna pagina caricata (la apre un toast) si rilegge.
     * Con un errore nulla cambia: la notifica resta non letta.
     */
    markNotificationRead: build.mutation<void, string>({
      query: (id) => ({ url: `/api/notifications/${encodeURIComponent(id)}/read`, method: 'POST' }),
      async onQueryStarted(id, { dispatch, getState, queryFulfilled }) {
        try {
          await queryFulfilled
        } catch {
          return // la lettura non è riuscita: resta non letta
        }
        let found = false
        let wasUnread = false
        for (const page of cachedPages(getState() as RootState)) {
          dispatch(
            notificationsApi.util.updateQueryData('getNotifications', page, (data) => {
              const row = data.content.find((candidate) => candidate.id === id)
              if (!row) return
              found = true
              if (!row.read) wasUnread = true
              row.read = true
            }),
          )
        }
        if (!found) {
          dispatch(notificationsApi.util.invalidateTags(['Notification']))
        } else if (wasUnread) {
          dispatch(notificationsApi.util.updateQueryData('getUnreadCount', undefined, (count) => Math.max(0, count - 1)))
        }
      },
    }),

    /** `POST /api/notifications/read-all` (204): tutte le righe caricate diventano lette e il numero va a zero. */
    markAllNotificationsRead: build.mutation<void, void>({
      query: () => ({ url: '/api/notifications/read-all', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, getState, queryFulfilled }) {
        try {
          await queryFulfilled
        } catch {
          return // nulla cambia
        }
        for (const page of cachedPages(getState() as RootState)) {
          dispatch(
            notificationsApi.util.updateQueryData('getNotifications', page, (data) => {
              data.content.forEach((row) => {
                row.read = true
              })
            }),
          )
        }
        dispatch(notificationsApi.util.updateQueryData('getUnreadCount', undefined, () => 0))
      },
    }),
  }),
})

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationsApi

/** Numeri delle pagine dell'elenco già in cache. */
const cachedPages = (state: RootState) => notificationsApi.util.selectCachedArgsForQuery(state, 'getNotifications')

/**
 * Unisce all'elenco salvato una notifica arrivata su `/user/queue/notifications` (progettazione, sezione 7.4), senza
 * chiamare il server: ha già l'`id` della riga salvata. Entra in cima alla prima pagina, non letta (se la pagina è piena
 * toglie l'ultima riga, così resta uguale a quella del server) e alza il numero; una notifica già presente non conta due
 * volte. Un nuovo messaggio (senza `id`) non si salva e non entra. Se sono aperte altre pagine le righe si sono spostate:
 * si rileggono. Senza elenco o numero in cache non fa nulla, la prima lettura li porterà.
 */
export function receiveLiveNotification(dispatch: AppDispatch, getState: () => unknown, notification: LiveNotification) {
  const { id, type } = notification
  if (!id || type === 'NEW_MESSAGE') return
  const state = getState() as RootState
  const pages = cachedPages(state)
  const known = pages.some((page) =>
    notificationsApi.endpoints.getNotifications
      .select(page)(state)
      .data?.content.some((row) => row.id === id),
  )
  if (known) return

  const saved: NotificationResponse = {
    id,
    type,
    actor: notification.actor,
    targetId: notification.targetId,
    createdAt: notification.createdAt,
    read: false,
  }
  dispatch(
    notificationsApi.util.updateQueryData('getNotifications', 0, (data) => {
      data.content.unshift(saved)
      if (data.content.length > NOTIFICATIONS_PAGE_SIZE) data.content.pop()
      data.totalElements += 1
    }),
  )
  dispatch(notificationsApi.util.updateQueryData('getUnreadCount', undefined, (count) => count + 1))
  if (pages.some((page) => page !== 0)) dispatch(notificationsApi.util.invalidateTags(['Notification']))
}

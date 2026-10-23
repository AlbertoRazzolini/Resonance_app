import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { friendsApi } from '@/features/friends/api/friendsApi'
import { makeNotification, makeNotifications } from '@/test/fixtures/notifications'
import { makeLoginResponse } from '@/test/fixtures/users'
import { friendshipsFound } from '@/test/handlers/friends'
import {
  notificationPage,
  notificationReadRejected,
  notificationReadSucceeds,
  notificationsFound,
  readAllRejected,
  readAllSucceeds,
  unreadCountFound,
} from '@/test/handlers/notifications'
import { server } from '@/test/server'
import type { LiveNotification } from '@/types/chat'
import { NOTIFICATIONS_PAGE_SIZE, notificationsApi, receiveLiveNotification } from './notificationsApi'

// Endpoint delle notifiche salvate (decisione 97): elenco a pagine di 10, numero delle non lette, segna letta e segna
// tutte lette. La lettura riuscita aggiorna elenco e numero in cache senza richiamare il server; una notifica live
// con `id` entra in cima alla prima pagina e alza il numero, una sola volta.
function setup() {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse()))
  const list = (page = 0) => notificationsApi.endpoints.getNotifications.select(page)(store.getState()).data
  const count = () => notificationsApi.endpoints.getUnreadCount.select()(store.getState()).data
  const load = async (page = 0) => store.dispatch(notificationsApi.endpoints.getNotifications.initiate(page)).unwrap()
  const loadCount = async () => store.dispatch(notificationsApi.endpoints.getUnreadCount.initiate()).unwrap()
  return { store, list, count, load, loadCount }
}

describe('notificationsApi · lettura', () => {
  it('chiede una pagina da 10 e passa il numero della pagina', async () => {
    const calls: Request[] = []
    server.use(notificationsFound([notificationPage([]), notificationPage([], { page: 1 })], calls))
    const { load } = setup()

    await load(1)

    const params = new URL(calls[0].url).searchParams
    expect(params.get('page')).toBe('1')
    expect(params.get('size')).toBe(String(NOTIFICATIONS_PAGE_SIZE))
    expect(NOTIFICATIONS_PAGE_SIZE).toBe(10)
  })

  it('il numero delle non lette è il campo count della risposta', async () => {
    server.use(unreadCountFound(7))
    const { loadCount } = setup()

    expect(await loadCount()).toBe(7)
  })
})

describe('notificationsApi · segna letta', () => {
  it('chiama POST .../{id}/read, segna letta quella riga e abbassa il numero di uno', async () => {
    const calls: Request[] = []
    const rows = makeNotifications(3)
    server.use(notificationsFound([notificationPage(rows)]), unreadCountFound(3), notificationReadSucceeds(calls))
    const { store, list, count, load, loadCount } = setup()
    await load()
    await loadCount()

    await store.dispatch(notificationsApi.endpoints.markNotificationRead.initiate('n2')).unwrap()

    expect(new URL(calls[0].url).pathname).toBe('/api/notifications/n2/read')
    expect(list()?.content.map((row) => row.read)).toEqual([false, true, false])
    expect(count()).toBe(2)
  })

  it('una riga già letta non abbassa il numero', async () => {
    server.use(
      notificationsFound([notificationPage([makeNotification({ id: 'n1', read: true })])]),
      unreadCountFound(5),
      notificationReadSucceeds(),
    )
    const { store, count, load, loadCount } = setup()
    await load()
    await loadCount()

    await store.dispatch(notificationsApi.endpoints.markNotificationRead.initiate('n1')).unwrap()

    expect(count()).toBe(5)
  })

  it('se la lettura fallisce la riga resta non letta e il numero non cambia', async () => {
    server.use(
      notificationsFound([notificationPage(makeNotifications(2))]),
      unreadCountFound(2),
      notificationReadRejected(404, 'NOT_FOUND'),
    )
    const { store, list, count, load, loadCount } = setup()
    await load()
    await loadCount()

    await store.dispatch(notificationsApi.endpoints.markNotificationRead.initiate('n1'))

    expect(list()?.content.every((row) => !row.read)).toBe(true)
    expect(count()).toBe(2)
  })

  it('una notifica che non è nelle pagine caricate fa rileggere il numero dal server', async () => {
    const countCalls: Request[] = []
    server.use(unreadCountFound(4, countCalls), notificationReadSucceeds())
    const { store, loadCount } = setup()
    await loadCount()

    await store.dispatch(notificationsApi.endpoints.markNotificationRead.initiate('altrove')).unwrap()

    await expect.poll(() => countCalls.length).toBe(2)
  })
})

describe('notificationsApi · segna tutte lette', () => {
  it('chiama POST .../read-all, segna lette tutte le pagine caricate e porta il numero a zero', async () => {
    const calls: Request[] = []
    server.use(
      notificationsFound([
        notificationPage(makeNotifications(2), { totalPages: 2, totalElements: 3 }),
        notificationPage([makeNotification({ id: 'n9' })], { page: 1, totalPages: 2, totalElements: 3 }),
      ]),
      unreadCountFound(3),
      readAllSucceeds(calls),
    )
    const { store, list, count, load, loadCount } = setup()
    await load(0)
    await load(1)
    await loadCount()

    await store.dispatch(notificationsApi.endpoints.markAllNotificationsRead.initiate()).unwrap()

    expect(new URL(calls[0].url).pathname).toBe('/api/notifications/read-all')
    expect(list(0)?.content.every((row) => row.read)).toBe(true)
    expect(list(1)?.content.every((row) => row.read)).toBe(true)
    expect(count()).toBe(0)
  })

  it('se fallisce nulla cambia', async () => {
    server.use(
      notificationsFound([notificationPage(makeNotifications(2))]),
      unreadCountFound(2),
      readAllRejected(500, 'INTERNAL_ERROR'),
    )
    const { store, list, count, load, loadCount } = setup()
    await load()
    await loadCount()

    await store.dispatch(notificationsApi.endpoints.markAllNotificationsRead.initiate())

    expect(list()?.content.every((row) => !row.read)).toBe(true)
    expect(count()).toBe(2)
  })
})

describe('receiveLiveNotification', () => {
  const live = (overrides: Partial<LiveNotification> = {}): LiveNotification => ({
    id: 'nuova',
    type: 'FRIEND_REQUEST',
    createdAt: '2026-10-23T11:00:00Z',
    actor: { id: 'u-mario', displayName: 'Mario Bianchi', avatarUrl: null },
    targetId: 'amicizia-1',
    preview: null,
    ...overrides,
  })

  it('entra in cima alla prima pagina, non letta, e alza il numero di uno', async () => {
    server.use(notificationsFound([notificationPage(makeNotifications(3))]), unreadCountFound(3))
    const { store, list, count, load, loadCount } = setup()
    await load()
    await loadCount()

    receiveLiveNotification(store.dispatch, store.getState, live())

    const first = list()?.content[0]
    expect(first).toEqual({
      id: 'nuova',
      type: 'FRIEND_REQUEST',
      actor: { id: 'u-mario', displayName: 'Mario Bianchi', avatarUrl: null },
      targetId: 'amicizia-1',
      createdAt: '2026-10-23T11:00:00Z',
      read: false,
    })
    expect(list()?.content).toHaveLength(4)
    expect(list()?.totalElements).toBe(4)
    expect(count()).toBe(4)
  })

  it('con la prima pagina piena toglie l’ultima riga, così resta uguale a quella del server', async () => {
    server.use(
      notificationsFound([notificationPage(makeNotifications(NOTIFICATIONS_PAGE_SIZE), { totalElements: 10 })]),
      unreadCountFound(10),
    )
    const { store, list, load, loadCount } = setup()
    await load()
    await loadCount()

    receiveLiveNotification(store.dispatch, store.getState, live())

    expect(list()?.content).toHaveLength(NOTIFICATIONS_PAGE_SIZE)
    expect(list()?.content[0].id).toBe('nuova')
    expect(list()?.content.at(-1)?.id).toBe('n9')
  })

  it('arrivata due volte (id già nell’elenco) entra e conta una volta sola', async () => {
    server.use(notificationsFound([notificationPage(makeNotifications(2))]), unreadCountFound(2))
    const { store, list, count, load, loadCount } = setup()
    await load()
    await loadCount()

    receiveLiveNotification(store.dispatch, store.getState, live())
    receiveLiveNotification(store.dispatch, store.getState, live())

    expect(list()?.content.filter((row) => row.id === 'nuova')).toHaveLength(1)
    expect(count()).toBe(3)
  })

  it('un nuovo messaggio (senza id) non entra né nell’elenco né nel numero', async () => {
    server.use(notificationsFound([notificationPage(makeNotifications(2))]), unreadCountFound(2))
    const { store, list, count, load, loadCount } = setup()
    await load()
    await loadCount()

    receiveLiveNotification(store.dispatch, store.getState, live({ id: null, type: 'NEW_MESSAGE', preview: 'Ciao' }))

    expect(list()?.content).toHaveLength(2)
    expect(count()).toBe(2)
  })

  it('senza elenco né numero in cache non fa nulla: la prima lettura li porterà', () => {
    const { store, list, count } = setup()

    receiveLiveNotification(store.dispatch, store.getState, live())

    expect(list()).toBeUndefined()
    expect(count()).toBeUndefined()
  })

  it('con altre pagine già aperte le fa rileggere, perché le righe si sono spostate', async () => {
    const calls: Request[] = []
    server.use(
      notificationsFound(
        [
          notificationPage(makeNotifications(NOTIFICATIONS_PAGE_SIZE), { totalPages: 2, totalElements: 12 }),
          notificationPage(makeNotifications(2, { id: 'x' }), { page: 1, totalPages: 2, totalElements: 12 }),
        ],
        calls,
      ),
      unreadCountFound(12),
    )
    const { store, load, loadCount } = setup()
    await load(0)
    await load(1)
    await loadCount()
    calls.length = 0

    receiveLiveNotification(store.dispatch, store.getState, live())

    await expect.poll(() => calls.length).toBeGreaterThanOrEqual(2)
  })

  // Il badge della voce Amici legge le richieste ricevute (FE-17): una richiesta in arrivo le fa rileggere, un'altra notifica no.
  it('una richiesta di amicizia fa rileggere le richieste ricevute, per il badge di Amici', async () => {
    const calls: Request[] = []
    server.use(friendshipsFound({}, calls))
    const { store } = setup()
    await store.dispatch(friendsApi.endpoints.getPendingRequests.initiate()).unwrap()
    expect(calls).toHaveLength(1)

    receiveLiveNotification(store.dispatch, store.getState, live({ type: 'FRIEND_REQUEST' }))

    await expect.poll(() => calls.length).toBe(2)
  })

  it('una notifica di altro tipo (mi piace) non fa rileggere le richieste ricevute', async () => {
    const calls: Request[] = []
    server.use(friendshipsFound({}, calls))
    const { store } = setup()
    await store.dispatch(friendsApi.endpoints.getPendingRequests.initiate()).unwrap()

    receiveLiveNotification(store.dispatch, store.getState, live({ type: 'NEW_LIKE' }))
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(calls).toHaveLength(1)
  })
})

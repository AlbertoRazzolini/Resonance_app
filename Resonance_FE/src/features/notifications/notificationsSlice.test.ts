import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionEnded } from '@/features/auth/authSlice'
import type { LiveNotification } from '@/types/chat'
import {
  markAllRead,
  markRead,
  received,
  selectNotifications,
  selectToasts,
  selectUnreadNotificationCount,
  toastDismissed,
} from './notificationsSlice'

// Notifiche live della sessione: solo in memoria, per la campanella (al massimo 20) e per i toast (al massimo 3, il più
// recente per ogni conversazione di messaggi). Si svuotano alla chiusura della sessione.
function notification(overrides: Partial<LiveNotification> = {}): LiveNotification {
  return {
    type: 'NEW_LIKE',
    createdAt: '2026-10-22T10:00:00Z',
    actor: { id: 'u1', displayName: 'Giulia Rossi', avatarUrl: null },
    targetId: 'post-1',
    preview: null,
    ...overrides,
  }
}

const message = (conversationId: string, preview = 'Ciao') =>
  notification({ type: 'NEW_MESSAGE', targetId: conversationId, preview })

describe('notificationsSlice · ricezione', () => {
  it('una notifica nuova entra non letta, con un id, in cima all’elenco', () => {
    const store = makeStore()
    store.dispatch(received(notification({ targetId: 'a' })))
    store.dispatch(received(notification({ targetId: 'b' })))

    const items = selectNotifications(store.getState())
    expect(items.map((item) => item.targetId)).toEqual(['b', 'a'])
    expect(items.every((item) => item.read === false)).toBe(true)
    expect(new Set(items.map((item) => item.id)).size).toBe(2)
  })

  it('tiene al massimo 20 notifiche: la più vecchia esce', () => {
    const store = makeStore()
    for (let i = 1; i <= 21; i++) store.dispatch(received(notification({ targetId: `t${i}` })))

    const items = selectNotifications(store.getState())
    expect(items).toHaveLength(20)
    expect(items[0].targetId).toBe('t21')
    expect(items.at(-1)?.targetId).toBe('t2')
  })

  it('i toast sono al massimo 3, i più recenti; le notifiche restano tutte', () => {
    const store = makeStore()
    for (let i = 1; i <= 4; i++) store.dispatch(received(notification({ targetId: `t${i}` })))

    expect(selectToasts(store.getState()).map((toast) => toast.targetId)).toEqual(['t4', 't3', 't2'])
    expect(selectNotifications(store.getState())).toHaveLength(4)
  })

  it('di una conversazione resta un solo toast, l’ultimo messaggio; le notifiche restano entrambe', () => {
    const store = makeStore()
    store.dispatch(received(message('c1', 'primo')))
    store.dispatch(received(message('c1', 'secondo')))

    expect(selectToasts(store.getState()).map((toast) => toast.preview)).toEqual(['secondo'])
    expect(selectNotifications(store.getState())).toHaveLength(2)
  })

  it('messaggi di conversazioni diverse hanno ciascuno il proprio toast', () => {
    const store = makeStore()
    store.dispatch(received(message('c1')))
    store.dispatch(received(message('c2')))

    expect(selectToasts(store.getState()).map((toast) => toast.targetId)).toEqual(['c2', 'c1'])
  })

  it('un like con lo stesso targetId di una conversazione non sostituisce il toast del messaggio', () => {
    const store = makeStore()
    store.dispatch(received(message('same')))
    store.dispatch(received(notification({ type: 'NEW_LIKE', targetId: 'same' })))

    expect(selectToasts(store.getState())).toHaveLength(2)
  })
})

describe('notificationsSlice · lettura e chiusura', () => {
  it('chiudere un toast lo toglie dai toast ma non dalle notifiche', () => {
    const store = makeStore()
    store.dispatch(received(notification()))
    const [toast] = selectToasts(store.getState())

    store.dispatch(toastDismissed(toast.id))

    expect(selectToasts(store.getState())).toEqual([])
    expect(selectNotifications(store.getState())).toHaveLength(1)
  })

  it('markRead segna letta solo quella notifica', () => {
    const store = makeStore()
    store.dispatch(received(notification({ targetId: 'a' })))
    store.dispatch(received(notification({ targetId: 'b' })))
    const [newer] = selectNotifications(store.getState())

    store.dispatch(markRead(newer.id))

    const items = selectNotifications(store.getState())
    expect(items.map((item) => item.read)).toEqual([true, false])
    expect(selectUnreadNotificationCount(store.getState())).toBe(1)
  })

  it('markAllRead le segna tutte lette', () => {
    const store = makeStore()
    store.dispatch(received(notification({ targetId: 'a' })))
    store.dispatch(received(notification({ targetId: 'b' })))

    store.dispatch(markAllRead())

    expect(selectUnreadNotificationCount(store.getState())).toBe(0)
    expect(selectNotifications(store.getState()).every((item) => item.read)).toBe(true)
  })

  it('markRead di un id sconosciuto non cambia nulla', () => {
    const store = makeStore()
    store.dispatch(received(notification()))
    store.dispatch(markRead('non-esiste'))
    expect(selectUnreadNotificationCount(store.getState())).toBe(1)
  })
})

describe('notificationsSlice · fine della sessione', () => {
  it('uscita o sospensione svuotano notifiche e toast: nessun dato resta in memoria', () => {
    const store = makeStore()
    store.dispatch(received(notification()))

    store.dispatch(sessionEnded())

    expect(selectNotifications(store.getState())).toEqual([])
    expect(selectToasts(store.getState())).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionEnded } from '@/features/auth/authSlice'
import type { LiveNotification } from '@/types/chat'
import { received, selectToasts, toastDismissed } from './notificationsSlice'

// Toast delle notifiche live: al massimo 3, i più recenti, e di una conversazione di messaggi resta il toast dell'ultimo.
// Si svuotano alla chiusura della sessione. Le notifiche salvate non stanno qui ma nella cache di RTK Query.
function notification(overrides: Partial<LiveNotification> = {}): LiveNotification {
  return {
    id: 'n-1',
    type: 'NEW_LIKE',
    createdAt: '2026-10-22T10:00:00Z',
    actor: { id: 'u1', displayName: 'Giulia Rossi', avatarUrl: null },
    targetId: 'post-1',
    preview: null,
    ...overrides,
  }
}

const message = (conversationId: string, preview = 'Ciao') =>
  notification({ id: null, type: 'NEW_MESSAGE', targetId: conversationId, preview })

describe('notificationsSlice · toast', () => {
  it('un toast di una notifica salvata ha l’id della notifica, uno di un messaggio un id nuovo', () => {
    const store = makeStore()
    store.dispatch(received(notification({ id: 'salvata' })))
    store.dispatch(received(message('c1')))

    const [fromMessage, saved] = selectToasts(store.getState())
    expect(saved.id).toBe('salvata')
    expect(fromMessage.id).toBeTruthy()
    expect(fromMessage.id).not.toBe('salvata')
  })

  it('i toast sono al massimo 3, i più recenti', () => {
    const store = makeStore()
    for (let i = 1; i <= 4; i++) store.dispatch(received(notification({ id: `n${i}`, targetId: `t${i}` })))

    expect(selectToasts(store.getState()).map((toast) => toast.targetId)).toEqual(['t4', 't3', 't2'])
  })

  it('di una conversazione resta un solo toast, l’ultimo messaggio', () => {
    const store = makeStore()
    store.dispatch(received(message('c1', 'primo')))
    store.dispatch(received(message('c1', 'secondo')))

    expect(selectToasts(store.getState()).map((toast) => toast.preview)).toEqual(['secondo'])
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

  it('una notifica salvata arrivata due volte ha un solo toast', () => {
    const store = makeStore()
    store.dispatch(received(notification({ id: 'doppia' })))
    store.dispatch(received(notification({ id: 'doppia' })))

    expect(selectToasts(store.getState())).toHaveLength(1)
  })

  it('chiudere un toast lo toglie', () => {
    const store = makeStore()
    store.dispatch(received(notification()))
    const [toast] = selectToasts(store.getState())

    store.dispatch(toastDismissed(toast.id))

    expect(selectToasts(store.getState())).toEqual([])
  })
})

describe('notificationsSlice · fine della sessione', () => {
  it('uscita o sospensione svuotano i toast: nessun dato resta in memoria', () => {
    const store = makeStore()
    store.dispatch(received(notification()))

    store.dispatch(sessionEnded())

    expect(selectToasts(store.getState())).toEqual([])
  })
})

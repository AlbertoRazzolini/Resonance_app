import { describe, expect, it } from 'vitest'
import { notificationPath, notificationText } from './notificationInfo'
import type { LiveNotification } from '@/types/chat'

// Testo e destinazione di ogni tipo di notifica live, uguali in toast e campanella (testi approvati in FE-09b).
const base: LiveNotification = {
  type: 'NEW_LIKE',
  createdAt: '2026-10-22T10:00:00Z',
  actor: { id: 'u1', displayName: 'Giulia Rossi', avatarUrl: null },
  targetId: 'target-1',
  preview: null,
}

describe('notificationText', () => {
  it('NEW_LIKE: «NOME ha messo mi piace al tuo post»', () => {
    expect(notificationText({ ...base, type: 'NEW_LIKE' })).toBe('Giulia Rossi ha messo mi piace al tuo post')
  })

  it('COLLAB_APPLICATION: «NOME si è candidato al tuo annuncio»', () => {
    expect(notificationText({ ...base, type: 'COLLAB_APPLICATION' })).toBe(
      'Giulia Rossi si è candidato al tuo annuncio',
    )
  })

  it('NEW_MESSAGE: «Nuovo messaggio da NOME»', () => {
    expect(notificationText({ ...base, type: 'NEW_MESSAGE', preview: 'Ciao' })).toBe('Nuovo messaggio da Giulia Rossi')
  })
})

describe('notificationPath', () => {
  it('NEW_LIKE porta al feed: non esiste una pagina del singolo post', () => {
    expect(notificationPath({ ...base, type: 'NEW_LIKE' })).toBe('/feed')
  })

  it('COLLAB_APPLICATION porta all’annuncio', () => {
    expect(notificationPath({ ...base, type: 'COLLAB_APPLICATION' })).toBe('/collab/target-1')
  })

  it('NEW_MESSAGE porta alla conversazione', () => {
    expect(notificationPath({ ...base, type: 'NEW_MESSAGE' })).toBe('/chat/target-1')
  })
})

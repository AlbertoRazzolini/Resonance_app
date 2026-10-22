import { describe, expect, it } from 'vitest'
import { makeConversation, makeMessage } from '@/test/fixtures/chat'
import {
  filterConversations,
  mergeHistory,
  totalUnread,
  withConversationRead,
  withHistoryMessage,
  withIncomingMessage,
} from './chatCache'

const ME = 'user-me'

// Regole della cache delle conversazioni: numero dei messaggi non letti, effetto di un messaggio in arrivo
// (ultimo messaggio, non letti, ordine, nessun doppio conteggio), lettura e ricerca per nome.
describe('totalUnread', () => {
  it('somma gli unreadCount di tutte le conversazioni', () => {
    const list = [makeConversation({ unreadCount: 2 }), makeConversation({ id: 'c2', unreadCount: 5 })]
    expect(totalUnread(list)).toBe(7)
  })

  it('senza conversazioni è zero', () => {
    expect(totalUnread([])).toBe(0)
  })
})

describe('withIncomingMessage', () => {
  const older = makeConversation({ id: 'c-old', unreadCount: 0, lastMessageAt: '2026-10-22T10:00:00Z' })
  const newer = makeConversation({ id: 'c-new', unreadCount: 0, lastMessageAt: '2026-10-22T11:00:00Z' })

  it('un messaggio dell’altro aggiorna l’ultimo messaggio e aggiunge un non letto', () => {
    const message = makeMessage({ id: 'm9', conversationId: 'c-old', body: 'Nuovo!', sentAt: '2026-10-22T12:00:00Z' })
    const result = withIncomingMessage([newer, older], message, { myId: ME, isOpen: false })

    const updated = result?.find((conversation) => conversation.id === 'c-old')
    expect(updated?.lastMessage).toEqual({ body: 'Nuovo!', senderId: 'user-2', sentAt: '2026-10-22T12:00:00Z' })
    expect(updated?.lastMessageAt).toBe('2026-10-22T12:00:00Z')
    expect(updated?.unreadCount).toBe(1)
  })

  it('porta la conversazione in cima all’elenco', () => {
    const message = makeMessage({ conversationId: 'c-old', sentAt: '2026-10-22T12:00:00Z' })
    const result = withIncomingMessage([newer, older], message, { myId: ME, isOpen: false })
    expect(result?.map((conversation) => conversation.id)).toEqual(['c-old', 'c-new'])
  })

  it('un messaggio dell’altro in una conversazione aperta non aggiunge non letti', () => {
    const message = makeMessage({ conversationId: 'c-old', sentAt: '2026-10-22T12:00:00Z' })
    const result = withIncomingMessage([older], message, { myId: ME, isOpen: true })
    expect(result?.[0].unreadCount).toBe(0)
    expect(result?.[0].lastMessage?.body).toBe('Ciao!')
  })

  it('un messaggio mio aggiorna l’ultimo messaggio ma non aggiunge non letti', () => {
    const message = makeMessage({ conversationId: 'c-old', senderId: ME, sentAt: '2026-10-22T12:00:00Z' })
    const result = withIncomingMessage([older], message, { myId: ME, isOpen: false })
    expect(result?.[0].unreadCount).toBe(0)
    expect(result?.[0].lastMessage?.senderId).toBe(ME)
  })

  it('lo stesso messaggio ricevuto due volte conta una volta sola', () => {
    const message = makeMessage({ conversationId: 'c-old', sentAt: '2026-10-22T12:00:00Z' })
    const once = withIncomingMessage([older], message, { myId: ME, isOpen: false })
    const twice = withIncomingMessage(once ?? [], message, { myId: ME, isOpen: false })
    expect(twice?.[0].unreadCount).toBe(1)
  })

  it('una conversazione che non è nell’elenco dà null: va ricaricato dal server', () => {
    const message = makeMessage({ conversationId: 'sconosciuta' })
    expect(withIncomingMessage([older], message, { myId: ME, isOpen: false })).toBeNull()
  })

  it('non cambia le altre conversazioni', () => {
    const message = makeMessage({ conversationId: 'c-old', sentAt: '2026-10-22T12:00:00Z' })
    const result = withIncomingMessage([newer, older], message, { myId: ME, isOpen: false })
    expect(result?.find((conversation) => conversation.id === 'c-new')).toEqual(newer)
  })
})

describe('withConversationRead', () => {
  it('azzera i non letti della sola conversazione indicata', () => {
    const list = [makeConversation({ id: 'a', unreadCount: 3 }), makeConversation({ id: 'b', unreadCount: 4 })]
    const result = withConversationRead(list, 'a')
    expect(result.map((conversation) => conversation.unreadCount)).toEqual([0, 4])
  })
})

describe('filterConversations', () => {
  const list = [
    makeConversation({ id: 'a', otherUser: { id: 'u1', displayName: 'Giulia Rossi', avatarUrl: null } }),
    makeConversation({ id: 'b', otherUser: { id: 'u2', displayName: 'José Álvarez', avatarUrl: null } }),
    makeConversation({ id: 'c', otherUser: { id: 'u3', displayName: 'Marco', avatarUrl: null } }),
  ]
  const ids = (found: typeof list) => found.map((conversation) => conversation.id)

  it('trova il testo contenuto nel nome, senza distinguere maiuscole', () => {
    expect(ids(filterConversations(list, 'rossi'))).toEqual(['a'])
    expect(ids(filterConversations(list, 'MARC'))).toEqual(['c'])
  })

  it('ignora gli accenti, da una parte e dall’altra', () => {
    expect(ids(filterConversations(list, 'jose'))).toEqual(['b'])
    expect(ids(filterConversations(list, 'álvarez'))).toEqual(['b'])
  })

  it('senza testo (o con soli spazi) restituisce tutto l’elenco', () => {
    expect(filterConversations(list, '')).toBe(list)
    expect(filterConversations(list, '   ')).toBe(list)
  })

  it('senza risultati restituisce un elenco vuoto', () => {
    expect(filterConversations(list, 'zzz')).toEqual([])
  })
})

// Storico a cursore: le pagine vanno dal messaggio più recente al più vecchio; unirle non deve lasciare buchi né
// doppioni, e un messaggio ricevuto due volte (push dopo una riconnessione e rilettura) compare una volta sola.
describe('mergeHistory', () => {
  /** Messaggio `n` della conversazione: il numero più alto è il più recente (un minuto di distanza l’uno dall’altro). */
  const message = (n: number) =>
    makeMessage({ id: `m${String(n).padStart(2, '0')}`, sentAt: new Date(Date.UTC(2026, 9, 22, 10, n)).toISOString() })
  /** Pagina con i messaggi da `to` a `from` (dal più recente). */
  const page = (to: number, from: number, hasMore: boolean) => ({
    messages: Array.from({ length: to - from + 1 }, (_, i) => message(to - i)),
    hasMore,
  })
  const ids = (merged: { messages: { id: string }[] }) => merged.messages.map((m) => m.id)

  it('senza storico già caricato restituisce la pagina così com’è', () => {
    const first = page(30, 21, true)
    expect(mergeHistory(undefined, first)).toEqual(first)
  })

  it('una pagina più vecchia si accoda in fondo, dal più recente, senza buchi', () => {
    const merged = mergeHistory(page(30, 21, true), page(20, 11, true))
    expect(ids(merged)).toEqual(Array.from({ length: 20 }, (_, i) => `m${30 - i}`))
  })

  it('dopo una pagina più vecchia vale il suo hasMore, che dice se ce ne sono ancora', () => {
    expect(mergeHistory(page(30, 21, true), page(20, 11, false)).hasMore).toBe(false)
    expect(mergeHistory(page(30, 21, true), page(20, 11, true)).hasMore).toBe(true)
  })

  it('la rilettura della pagina più recente aggiunge i messaggi nuovi e tiene lo storico già caricato', () => {
    const loaded = mergeHistory(page(30, 21, true), page(20, 11, false))
    const reread = mergeHistory(loaded, page(32, 23, true))
    expect(ids(reread)).toEqual(Array.from({ length: 22 }, (_, i) => `m${32 - i}`))
    // I messaggi più vecchi erano già tutti caricati: hasMore resta quello dello storico, non della pagina riletta
    expect(reread.hasMore).toBe(false)
  })

  it('la stessa pagina due volte non crea doppioni', () => {
    const first = page(30, 21, true)
    expect(ids(mergeHistory(first, first))).toEqual(ids(first))
  })

  it('dopo una lunga assenza, con una pagina nuova che non tocca lo storico, riparte dalla pagina nuova', () => {
    // Fra m21 e m60 mancano messaggi: unirli lascerebbe un buco, quindi si tiene solo la pagina più recente
    const reread = mergeHistory(page(30, 21, true), page(60, 51, true))
    expect(ids(reread)).toEqual(Array.from({ length: 10 }, (_, i) => `m${60 - i}`))
    expect(reread.hasMore).toBe(true)
  })

  it('ordina dal più recente anche se la pagina arriva con un ordine diverso', () => {
    const shuffled = { messages: [message(21), message(23), message(22)], hasMore: false }
    expect(ids(mergeHistory(undefined, shuffled))).toEqual(['m23', 'm22', 'm21'])
  })
})

describe('withHistoryMessage', () => {
  const base = {
    messages: [
      makeMessage({ id: 'a', sentAt: '2026-10-22T10:02:00Z' }),
      makeMessage({ id: 'b', sentAt: '2026-10-22T10:01:00Z' }),
    ],
    hasMore: true,
  }

  it('un messaggio nuovo si aggiunge in cima', () => {
    const next = withHistoryMessage(base, makeMessage({ id: 'c', sentAt: '2026-10-22T10:03:00Z' }))
    expect(next.messages.map((m) => m.id)).toEqual(['c', 'a', 'b'])
    expect(next.hasMore).toBe(true)
  })

  it('lo stesso messaggio ricevuto due volte compare una volta sola (dedupe per id)', () => {
    const message = makeMessage({ id: 'c', sentAt: '2026-10-22T10:03:00Z' })
    const twice = withHistoryMessage(withHistoryMessage(base, message), message)
    expect(twice.messages.map((m) => m.id)).toEqual(['c', 'a', 'b'])
  })

  it('un messaggio già nello storico lascia lo storico identico', () => {
    expect(withHistoryMessage(base, base.messages[1])).toBe(base)
  })
})

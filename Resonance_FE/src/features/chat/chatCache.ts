import type { ChatMessageResponse, ConversationResponse, MessagePageResponse } from '@/types/chat'

// Regole pure della cache della chat: aggiornano l'elenco delle conversazioni e lo storico senza chiamare il server
// (progettazione, sezione 7.6: un messaggio ricevuto su STOMP è già salvato).

/** Messaggi non letti in tutto: la somma degli `unreadCount`, il numero del badge sull'icona Messaggi. */
export const totalUnread = (conversations: ConversationResponse[]): number =>
  conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0)

/**
 * Effetto di un messaggio in arrivo sull'elenco: diventa l'ultimo messaggio, la conversazione sale in cima e, se è
 * dell'altro e la conversazione non è aperta, i non letti crescono di uno. Un messaggio non più recente
 * dell'ultimo già noto si ignora (consegna doppia dopo una riconnessione). `null` se la conversazione non è
 * nell'elenco: chi chiama la ricarica dal server.
 */
export function withIncomingMessage(
  conversations: ConversationResponse[],
  message: ChatMessageResponse,
  { myId, isOpen }: { myId: string; isOpen: boolean },
): ConversationResponse[] | null {
  const current = conversations.find((conversation) => conversation.id === message.conversationId)
  if (!current) return null
  if (current.lastMessageAt && Date.parse(message.sentAt) <= Date.parse(current.lastMessageAt)) return conversations

  const unread = message.senderId !== myId && !isOpen ? 1 : 0
  const updated: ConversationResponse = {
    ...current,
    lastMessage: { body: message.body, senderId: message.senderId, sentAt: message.sentAt },
    lastMessageAt: message.sentAt,
    unreadCount: current.unreadCount + unread,
  }
  return [updated, ...conversations.filter((conversation) => conversation !== current)]
}

/** Azzera i non letti della conversazione indicata (dopo `PATCH .../read`). */
export const withConversationRead = (conversations: ConversationResponse[], conversationId: string) =>
  conversations.map((conversation) =>
    conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
  )

/** Minuscolo e senza accenti, per confrontare un nome con il testo cercato. */
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/**
 * Conversazioni il cui nome contiene il testo cercato, senza distinguere maiuscole e accenti. Senza testo
 * restituisce lo stesso elenco.
 */
export function filterConversations(conversations: ConversationResponse[], query: string): ConversationResponse[] {
  const needle = normalize(query.trim())
  if (!needle) return conversations
  return conversations.filter((conversation) => normalize(conversation.otherUser.displayName).includes(needle))
}

/** Dal più recente al più vecchio: per istante di invio e, a parità, per id (come il cursore del backend, sezione 6.9). */
const newestFirst = (a: ChatMessageResponse, b: ChatMessageResponse) =>
  Date.parse(b.sentAt) - Date.parse(a.sentAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)

/**
 * Unisce una pagina dello storico a quello già caricato, dal più recente, senza doppioni (per id). `hasMore` è quello
 * del lato più vecchio: lo porta la pagina che arriva se arriva fino al messaggio più vecchio, altrimenti resta
 * quello già noto. Se la pagina nuova non tocca lo storico ed è più recente (dopo una lunga assenza), unirli
 * lascerebbe un buco: si riparte dalla pagina nuova e i messaggi vecchi si ricaricano con «Messaggi precedenti».
 */
export function mergeHistory(current: MessagePageResponse | undefined, incoming: MessagePageResponse): MessagePageResponse {
  const sortedIncoming = incoming.messages.toSorted(newestFirst)
  if (!current || current.messages.length === 0) return { messages: sortedIncoming, hasMore: incoming.hasMore }

  const knownIds = new Set(current.messages.map((message) => message.id))
  const overlaps = sortedIncoming.some((message) => knownIds.has(message.id))
  const newestKnown = current.messages.toSorted(newestFirst)[0]
  const oldestIncoming = sortedIncoming.at(-1)
  if (!overlaps && incoming.hasMore && oldestIncoming && newestFirst(oldestIncoming, newestKnown) < 0) {
    return { messages: sortedIncoming, hasMore: true }
  }

  const merged = [...current.messages, ...sortedIncoming.filter((message) => !knownIds.has(message.id))].toSorted(
    newestFirst,
  )
  const reachesOldest = merged.at(-1)?.id === oldestIncoming?.id
  return { messages: merged, hasMore: reachesOldest ? incoming.hasMore : current.hasMore }
}

/**
 * Aggiunge allo storico un messaggio ricevuto su STOMP. Un messaggio già presente (stesso id: push dopo una
 * riconnessione e rilettura REST) non cambia nulla: Review Focus 8 del piano.
 */
export function withHistoryMessage(history: MessagePageResponse, message: ChatMessageResponse): MessagePageResponse {
  if (history.messages.some((known) => known.id === message.id)) return history
  return { ...history, messages: [message, ...history.messages].toSorted(newestFirst) }
}

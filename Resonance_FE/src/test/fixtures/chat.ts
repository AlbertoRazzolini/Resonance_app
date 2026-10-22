import type { ChatMessageResponse, ConversationResponse } from '@/types/chat'

/** Conversazione di prova con un altro utente, un ultimo messaggio dell'altro e 2 non letti; `overrides` cambia i campi. */
export function makeConversation(overrides: Partial<ConversationResponse> = {}): ConversationResponse {
  return {
    id: 'conv-1',
    otherUser: { id: 'user-2', displayName: 'Giulia Rossi', avatarUrl: null },
    lastMessage: { body: 'Ci troviamo alle 20?', senderId: 'user-2', sentAt: '2026-10-22T18:42:00Z' },
    unreadCount: 2,
    lastMessageAt: '2026-10-22T18:42:00Z',
    canSend: true,
    ...overrides,
  }
}

/** Messaggio di prova dell'altro utente; `overrides` cambia i campi che interessano al test. */
export function makeMessage(overrides: Partial<ChatMessageResponse> = {}): ChatMessageResponse {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-2',
    body: 'Ciao!',
    sentAt: '2026-10-22T18:42:00Z',
    readAt: null,
    ...overrides,
  }
}

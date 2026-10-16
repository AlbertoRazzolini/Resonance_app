package it.epicode.resonance.chat;

import it.epicode.resonance.chat.dto.ChatMessageResponse;

import java.util.UUID;

/**
 * Pubblicato da {@link ChatService#send} dentro la transazione: dopo il commit {@link ChatMessageListener} manda il
 * messaggio ai due membri (progettazione, sezione 7.6).
 */
public record ChatMessageEvent(UUID senderId, UUID recipientId, ChatMessageResponse message) {
}

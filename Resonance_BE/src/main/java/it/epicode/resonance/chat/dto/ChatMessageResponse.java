package it.epicode.resonance.chat.dto;

import it.epicode.resonance.chat.ChatMessage;

import java.time.Instant;
import java.util.UUID;

/**
 * Un messaggio (progettazione, sezioni 6.9 e 7.4): lo stesso DTO per lo storico REST e per la consegna su
 * {@code /user/queue/messages}.
 */
public record ChatMessageResponse(UUID id, UUID conversationId, UUID senderId, String body, Instant sentAt,
                                  Instant readAt) {

    public static ChatMessageResponse from(ChatMessage message) {
        return new ChatMessageResponse(message.getId(), message.getConversation().getId(),
                message.getSender().getId(), message.getBody(), message.getSentAt(), message.getReadAt());
    }
}

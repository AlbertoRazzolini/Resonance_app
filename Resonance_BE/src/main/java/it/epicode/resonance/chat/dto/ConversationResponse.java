package it.epicode.resonance.chat.dto;

import it.epicode.resonance.chat.ChatMessage;
import it.epicode.resonance.user.dto.AuthorSummary;

import java.time.Instant;
import java.util.UUID;

/**
 * Una conversazione vista da uno dei due membri (progettazione, sezione 6.9): l'altro utente, l'ultimo messaggio,
 * i messaggi non letti e se si puo' scrivere. {@code canSend} falso non toglie la lettura dello storico.
 */
public record ConversationResponse(UUID id, AuthorSummary otherUser, LastMessage lastMessage, long unreadCount,
                                   Instant lastMessageAt, boolean canSend) {

    /**
     * Ultimo messaggio della conversazione, in forma ridotta.
     */
    public record LastMessage(String body, UUID senderId, Instant sentAt) {

        public static LastMessage from(ChatMessage message) {
            return new LastMessage(message.getBody(), message.getSender().getId(), message.getSentAt());
        }
    }
}

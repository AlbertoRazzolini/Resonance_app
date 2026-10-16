package it.epicode.resonance.chat.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * Richiesta di apertura di una conversazione con un altro utente (progettazione, sezione 6.9).
 */
public record CreateConversationRequest(@NotNull UUID recipientId) {
}

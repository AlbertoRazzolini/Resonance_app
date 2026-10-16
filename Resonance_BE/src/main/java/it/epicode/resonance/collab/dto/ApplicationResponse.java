package it.epicode.resonance.collab.dto;

import java.util.UUID;

/**
 * Esito di una candidatura (progettazione, sezione 6.7): la conversazione con l'autore e il messaggio salvato.
 */
public record ApplicationResponse(UUID conversationId, UUID messageId) {
}

package it.epicode.resonance.event.dto;

import java.util.UUID;

/**
 * Esito di un contatto (progettazione, sezione 6.6): la conversazione con l'organizzatore e il messaggio salvato.
 */
public record ContactResponse(UUID conversationId, UUID messageId) {
}

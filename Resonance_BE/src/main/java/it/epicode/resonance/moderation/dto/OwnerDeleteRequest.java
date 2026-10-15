package it.epicode.resonance.moderation.dto;

import jakarta.validation.constraints.Size;

/**
 * Body facoltativo della cancellazione del proprietario (progettazione, sezione 5.7): il motivo e' libero e
 * puo' mancare. Un motivo vuoto o fatto di soli spazi vale come assente.
 */
public record OwnerDeleteRequest(@Size(max = 500) String reason) {

    public OwnerDeleteRequest {
        reason = reason == null || reason.isBlank() ? null : reason.strip();
    }
}

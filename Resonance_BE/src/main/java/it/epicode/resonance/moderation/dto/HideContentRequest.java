package it.epicode.resonance.moderation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body di "nascondi contenuto" (progettazione, sezione 5.7): il motivo e' obbligatorio, da 3 a 500 caratteri
 * dopo aver tolto gli spazi ai bordi.
 */
public record HideContentRequest(@NotBlank @Size(min = 3, max = 500) String reason) {

    public HideContentRequest {
        reason = reason == null ? null : reason.strip();
    }
}

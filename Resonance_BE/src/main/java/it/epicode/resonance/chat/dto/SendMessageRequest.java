package it.epicode.resonance.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Payload dell'invio su STOMP (progettazione, sezione 7.5). Si valida nel service e non con {@code @Valid}: la
 * validazione viene dopo i controlli su token e limite di frequenza.
 */
public record SendMessageRequest(@NotBlank @Size(max = 2000) String body) {
}

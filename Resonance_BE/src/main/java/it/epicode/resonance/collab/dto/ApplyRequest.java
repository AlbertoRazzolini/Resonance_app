package it.epicode.resonance.collab.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Candidatura a un annuncio (progettazione, sezione 6.7). Il massimo e' 1800 e non 2000: davanti al testo il
 * messaggio in chat porta il prefisso con il titolo (al massimo 150 caratteri), e il totale deve stare nei 2000 di
 * {@code chat_messages.body} (decisione 67).
 */
public record ApplyRequest(@NotBlank @Size(max = 1800) String message) {
}

package it.epicode.resonance.event.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Contatto dell'organizzatore di un evento (progettazione, sezione 6.6). Il massimo e' 1800 e non 2000: davanti al
 * testo il messaggio in chat porta il prefisso con il titolo (al massimo 150 caratteri), e il totale deve stare nei
 * 2000 di {@code chat_messages.body} (decisione 69, come per le candidature).
 */
public record ContactRequest(@NotBlank @Size(max = 1800) String message) {
}

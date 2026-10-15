package it.epicode.resonance.mail;

/**
 * Pubblicato dentro la transazione del reset della password: l'email di avviso parte dopo il commit
 * (progettazione, sezione 9).
 */
public record PasswordChangedEmailEvent(String recipient, String displayName) {
}

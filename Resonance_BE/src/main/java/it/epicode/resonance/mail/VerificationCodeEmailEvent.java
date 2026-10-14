package it.epicode.resonance.mail;

/**
 * Pubblicato dentro la transazione di registrazione e reinvio: l'email parte dopo il commit
 * (progettazione, sezione 9). Il codice e' un segreto: {@code toString} lo nasconde.
 */
public record VerificationCodeEmailEvent(String recipient, String displayName, String code) {

    @Override
    public String toString() {
        return "VerificationCodeEmailEvent[recipient=" + recipient + "]";
    }
}

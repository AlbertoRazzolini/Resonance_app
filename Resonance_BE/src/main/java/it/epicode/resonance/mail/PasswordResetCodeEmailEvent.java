package it.epicode.resonance.mail;

/**
 * Pubblicato dentro la transazione della password dimenticata: l'email parte dopo il commit
 * (progettazione, sezione 9). Il codice e' un segreto: {@code toString} lo nasconde.
 */
public record PasswordResetCodeEmailEvent(String recipient, String displayName, String code) {

    @Override
    public String toString() {
        return "PasswordResetCodeEmailEvent[recipient=" + recipient + "]";
    }
}

package it.epicode.resonance.mail;

/**
 * Le tre email del progetto (progettazione, sezione 9). Le chiama solo {@link EmailEventListener}, sempre
 * dopo il commit e in modo asincrono: se l'invio fallisce si scrive nel log e la richiesta resta valida.
 */
public interface EmailService {

    void sendVerificationCode(String recipient, String displayName, String code);

    void sendPasswordResetCode(String recipient, String displayName, String code);

    void sendPasswordChanged(String recipient, String displayName);
}

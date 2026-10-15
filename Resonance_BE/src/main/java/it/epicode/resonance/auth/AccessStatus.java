package it.epicode.resonance.auth;

/**
 * Esito della lettura dello stato di accesso di un utente (progettazione, sezione 5.2).
 */
public enum AccessStatus {
    ACTIVE,
    SUSPENDED,
    NOT_VERIFIED,
    NOT_FOUND
}

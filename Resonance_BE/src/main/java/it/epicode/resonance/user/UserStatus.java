package it.epicode.resonance.user;

/**
 * Stato dell'utente. Corrisponde all'enum PostgreSQL user_status (progettazione, sezione 3.1):
 * la sospensione equivale al ban, non esiste uno stato BANNED.
 */
public enum UserStatus {
    ACTIVE,
    SUSPENDED
}

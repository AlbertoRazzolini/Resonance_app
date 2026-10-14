package it.epicode.resonance.user;

import java.time.Instant;

/**
 * Riga della query unica che legge stato e ruoli di un utente (progettazione, sezione 5.2): una riga
 * per ruolo, oppure una sola con role nullo se l'utente non ha ruoli.
 */
public record UserAccessRow(UserStatus status, boolean emailVerified, String suspensionReason,
                            Instant suspendedUntil, Role role) {
}

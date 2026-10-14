package it.epicode.resonance.auth;

import java.time.Instant;
import java.util.UUID;

/**
 * Contenuto di un access token valido: solo chi e' l'utente e quando scade. Ruoli e stato non ci
 * sono, si leggono dal database (progettazione, sezione 5.2).
 */
public record AccessTokenClaims(UUID userId, Instant expiresAt) {
}

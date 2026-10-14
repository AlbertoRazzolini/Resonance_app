package it.epicode.resonance.auth;

import java.time.Instant;

/**
 * Access token appena emesso e la sua scadenza, troncata ai secondi come nel JWT.
 */
public record IssuedAccessToken(String token, Instant expiresAt) {
}

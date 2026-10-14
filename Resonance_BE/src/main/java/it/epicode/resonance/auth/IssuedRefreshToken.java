package it.epicode.resonance.auth;

import java.time.Instant;
import java.util.UUID;

/**
 * Refresh token appena creato: "value" e' il valore in chiaro, che esiste solo qui e nel cookie
 * (nel database c'e' solo l'hash). Il toString lo omette perche' non finisca nei log.
 */
public record IssuedRefreshToken(UUID id, String value, Instant expiresAt) {

    @Override
    public String toString() {
        return "IssuedRefreshToken[id=" + id + ", expiresAt=" + expiresAt + "]";
    }
}

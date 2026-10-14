package it.epicode.resonance.auth;

import it.epicode.resonance.auth.dto.LoginResponse;

/**
 * Sessione appena aperta: il corpo della risposta (access token e profilo) e il valore del refresh
 * token, che il controller mette nel cookie e non nel body.
 */
public record AuthSession(LoginResponse response, String refreshToken) {

    // Il valore del refresh token non deve finire nei log.
    @Override
    public String toString() {
        return "AuthSession[response=" + response + "]";
    }
}

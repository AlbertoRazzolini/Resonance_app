package it.epicode.resonance.auth.dto;

import it.epicode.resonance.user.dto.MeResponse;

import java.time.Instant;

/**
 * Risposta di login, verifica e refresh (progettazione, sezione 6.4): l'access token va tenuto solo in
 * memoria dal frontend; il refresh token non e' nel body, viaggia nel cookie.
 */
public record LoginResponse(String accessToken, Instant accessTokenExpiresAt, MeResponse user) {
}

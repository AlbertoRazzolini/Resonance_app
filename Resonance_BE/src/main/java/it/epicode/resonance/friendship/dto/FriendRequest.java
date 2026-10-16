package it.epicode.resonance.friendship.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * Richiesta di amicizia: l'utente a cui la si invia (progettazione, sezione 6.14).
 */
public record FriendRequest(@NotNull UUID userId) {
}

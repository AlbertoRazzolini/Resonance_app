package it.epicode.resonance.admin;

import java.util.UUID;

/**
 * Evento pubblicato quando un utente viene sospeso (progettazione, sezione 5.5). Dopo il commit chiude le sessioni
 * WebSocket dell'utente: l'ascoltatore arriva con il real-time.
 */
public record UserSuspendedEvent(UUID userId) {
}

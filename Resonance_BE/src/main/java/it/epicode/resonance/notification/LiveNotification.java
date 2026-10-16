package it.epicode.resonance.notification;

import it.epicode.resonance.user.dto.AuthorSummary;

import java.time.Instant;
import java.util.UUID;

/**
 * Payload consegnato su {@code /user/queue/notifications} (progettazione, sezione 7.4). {@code preview} c'e' solo
 * per {@code NEW_MESSAGE}: i primi 100 caratteri del messaggio.
 */
public record LiveNotification(NotificationType type, Instant createdAt, AuthorSummary actor, UUID targetId,
                               String preview) {
}

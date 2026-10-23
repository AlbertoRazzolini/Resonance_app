package it.epicode.resonance.notification.dto;

import it.epicode.resonance.notification.Notification;
import it.epicode.resonance.notification.NotificationType;
import it.epicode.resonance.user.dto.AuthorSummary;

import java.time.Instant;
import java.util.UUID;

/**
 * Notifica salvata vista dal destinatario (decisione 97): senza anteprima, le notifiche salvate non portano testo.
 */
public record NotificationResponse(UUID id, NotificationType type, AuthorSummary actor, UUID targetId,
                                   Instant createdAt, boolean read) {

    public static NotificationResponse from(Notification notification) {
        return new NotificationResponse(notification.getId(), notification.getType(),
                AuthorSummary.from(notification.getActor()), notification.getTargetId(), notification.getCreatedAt(),
                notification.getReadAt() != null);
    }
}

package it.epicode.resonance.notification;

import java.util.UUID;

/**
 * Pubblicato dai service dentro la transazione: dopo il commit {@link LiveNotificationListener} lo consegna al
 * destinatario (progettazione, sezione 7.6).
 */
public record LiveNotificationEvent(UUID recipientId, LiveNotification notification) {
}

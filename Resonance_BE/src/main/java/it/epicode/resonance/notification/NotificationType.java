package it.epicode.resonance.notification;

/**
 * Tipi di notifica live (progettazione, sezione 7.4); il significato di {@code targetId} dipende dal tipo.
 */
public enum NotificationType {
    /** Nuovo like a un post del feed: {@code targetId} e' il post. */
    NEW_LIKE,
    /** Nuovo messaggio in chat: {@code targetId} e' la conversazione. */
    NEW_MESSAGE,
    /** Candidatura a un annuncio: {@code targetId} e' l'annuncio. */
    COLLAB_APPLICATION
}

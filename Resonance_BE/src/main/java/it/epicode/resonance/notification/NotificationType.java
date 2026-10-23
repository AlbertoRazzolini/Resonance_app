package it.epicode.resonance.notification;

/**
 * Tipi di notifica (progettazione, sezioni 7.4 e 7.6); il significato di {@code targetId} dipende dal tipo.
 * Tutti tranne {@link #NEW_MESSAGE} vengono anche salvati (tabella {@code notifications}, decisione 97).
 */
public enum NotificationType {
    /** Nuovo like a un post del feed: {@code targetId} e' il post. */
    NEW_LIKE,
    /** Nuovo messaggio in chat, solo live: {@code targetId} e' la conversazione. */
    NEW_MESSAGE,
    /** Candidatura a un annuncio: {@code targetId} e' l'annuncio. */
    COLLAB_APPLICATION,
    /** Richiesta di amicizia ricevuta: {@code targetId} e' l'amicizia. */
    FRIEND_REQUEST,
    /** Richiesta di amicizia accettata, per chi l'aveva mandata: {@code targetId} e' l'amicizia. */
    FRIEND_ACCEPTED
}

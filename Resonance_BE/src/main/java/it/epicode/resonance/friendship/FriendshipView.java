package it.epicode.resonance.friendship;

/**
 * Stato di un'amicizia visto da un utente verso un altro (progettazione, sezione 6.14): e' cio' che il frontend
 * mostra, e puo' differire da {@link FriendshipStatus} (per esempio il rifiuto silenzioso).
 */
public enum FriendshipView {
    NONE,
    OUTGOING,
    INCOMING,
    FRIENDS,
    UNAVAILABLE
}

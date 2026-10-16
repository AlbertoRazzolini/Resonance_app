package it.epicode.resonance.friendship;

import java.util.UUID;

/**
 * Relazione di un utente con un altro, per ricerca e chat (progettazione, sezione 6.14): lo stato visto e l'id
 * della riga, presente solo quando serve a operare (accetta, annulla, rimuovi).
 */
public record FriendshipRelation(FriendshipView status, UUID friendshipId) {

    /** Nessuna relazione: si puo' chiedere l'amicizia. */
    public static final FriendshipRelation NONE = new FriendshipRelation(FriendshipView.NONE, null);

    /** Non si puo' chiedere l'amicizia: l'altro non e' disponibile o ha rimosso l'amicizia. */
    public static final FriendshipRelation UNAVAILABLE = new FriendshipRelation(FriendshipView.UNAVAILABLE, null);
}

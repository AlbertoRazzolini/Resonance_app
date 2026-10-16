package it.epicode.resonance.friendship;

/**
 * Stato persistente di una riga di amicizia (progettazione, sezione 3.2). Lo stato che vede ciascun utente e'
 * {@link FriendshipView}, calcolato da questo e da chi ha chiuso la riga.
 */
public enum FriendshipStatus {
    PENDING,
    ACCEPTED,
    DECLINED,
    CANCELLED,
    REMOVED
}

package it.epicode.resonance.friendship.dto;

import it.epicode.resonance.friendship.FriendshipRelation;
import it.epicode.resonance.friendship.FriendshipView;

import java.util.UUID;

/**
 * Stato dell'amicizia con un utente trovato dalla ricerca (progettazione, sezione 6.5): lo stato visto da chi
 * cerca e l'id della riga, presente solo per OUTGOING, INCOMING e FRIENDS (serve ad annullare, accettare o
 * rimuovere).
 */
public record FriendshipSummary(FriendshipView status, UUID friendshipId) {

    /**
     * Dalla relazione calcolata da {@code FriendshipService.relationsFor}.
     */
    public static FriendshipSummary from(FriendshipRelation relation) {
        return new FriendshipSummary(relation.status(), relation.friendshipId());
    }
}

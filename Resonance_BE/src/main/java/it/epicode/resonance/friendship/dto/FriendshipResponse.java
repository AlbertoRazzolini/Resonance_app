package it.epicode.resonance.friendship.dto;

import it.epicode.resonance.friendship.Friendship;
import it.epicode.resonance.friendship.FriendshipView;
import it.epicode.resonance.user.dto.AuthorSummary;

import java.time.Instant;
import java.util.UUID;

/**
 * Amicizia vista da un utente (progettazione, sezione 6.14): l'altra parte in forma ridotta e lo stato visto dal
 * chiamante, non quello persistente.
 */
public record FriendshipResponse(UUID id, AuthorSummary otherUser, FriendshipView status, Instant updatedAt) {

    /**
     * Risposta per {@code me}: l'altro utente e' quello della riga che non e' {@code me}.
     */
    public static FriendshipResponse from(Friendship friendship, UUID me) {
        var other = friendship.getRequester().getId().equals(me) ? friendship.getAddressee() : friendship.getRequester();
        return new FriendshipResponse(friendship.getId(), AuthorSummary.from(other), friendship.viewFor(me),
                friendship.getUpdatedAt());
    }
}

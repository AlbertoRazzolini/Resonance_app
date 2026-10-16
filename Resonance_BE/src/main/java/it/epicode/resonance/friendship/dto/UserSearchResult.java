package it.epicode.resonance.friendship.dto;

import it.epicode.resonance.user.User;

import java.util.UUID;

/**
 * Un utente trovato dalla ricerca (progettazione, sezione 6.5): solo dati pubblici e lo stato dell'amicizia; mai
 * email, coordinate o ruoli.
 */
public record UserSearchResult(UUID id, String displayName, String avatarUrl, String city,
                               FriendshipSummary friendship) {

    /**
     * Risultato per un utente, con la sua relazione con chi cerca.
     */
    public static UserSearchResult from(User user, FriendshipSummary friendship) {
        return new UserSearchResult(user.getId(), user.getDisplayName(), user.getAvatarUrl(), user.getCity(),
                friendship);
    }
}

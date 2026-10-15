package it.epicode.resonance.user.dto;

import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserStatus;

import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Profilo dell'utente autenticato (progettazione, sezione 6.4). L'id e' presente solo qui, per il proprio
 * profilo: il frontend lo confronta con AuthorSummary.id e senderId per riconoscere i propri contenuti.
 * Mai l'hash della password ne' i dati di moderazione; i ruoli sono quelli letti dal database, in ordine stabile.
 */
public record MeResponse(
        UUID id,
        String email,
        String displayName,
        String avatarUrl,
        String bio,
        String city,
        Double latitude,
        Double longitude,
        List<Role> roles,
        UserStatus status,
        Instant createdAt
) {

    /**
     * Costruisce il profilo dall'utente e dai suoi ruoli, ordinati per livello (FAN prima di SUPERADMIN).
     */
    public static MeResponse from(User user, Collection<Role> roles) {
        return new MeResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getAvatarUrl(),
                user.getBio(), user.getCity(), user.getLatitude(), user.getLongitude(),
                roles.stream().sorted(Comparator.naturalOrder()).toList(), user.getStatus(), user.getCreatedAt());
    }
}

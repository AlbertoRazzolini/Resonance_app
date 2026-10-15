package it.epicode.resonance.user.dto;

import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Profilo pubblico di un utente (progettazione, sezione 6.5). Mai email, coordinate o stato: i ruoli sono
 * solo quelli di community (FAN, MUSICIAN, HOST), perche' ADMIN e SUPERADMIN non sono informazioni pubbliche.
 */
public record PublicUserResponse(
        UUID id,
        String displayName,
        String avatarUrl,
        String bio,
        String city,
        List<Role> roles
) {

    /**
     * Costruisce il profilo pubblico dall'utente e dai suoi ruoli, filtrati e in ordine stabile.
     */
    public static PublicUserResponse from(User user, Collection<Role> roles) {
        return new PublicUserResponse(user.getId(), user.getDisplayName(), user.getAvatarUrl(), user.getBio(),
                user.getCity(),
                roles.stream().filter(Role::isCommunity).sorted(Comparator.naturalOrder()).toList());
    }
}

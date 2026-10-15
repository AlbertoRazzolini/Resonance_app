package it.epicode.resonance.admin.dto;

import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserStatus;

import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Utente visto da un amministratore (progettazione, sezione 6.10), con i dati di sospensione. Mai l'hash della
 * password. L'id e' qui perche' serve alle azioni di amministrazione (decisione 49).
 */
public record AdminUserResponse(
        UUID id,
        String email,
        String displayName,
        List<Role> roles,
        UserStatus status,
        boolean emailVerified,
        Instant createdAt,
        Instant suspendedAt,
        UUID suspendedBy,
        String suspensionReason,
        Instant suspendedUntil
) {

    /**
     * Costruisce la risposta dall'utente e dai suoi ruoli, in ordine stabile (FAN prima di SUPERADMIN).
     */
    public static AdminUserResponse from(User user, Collection<Role> roles) {
        return new AdminUserResponse(user.getId(), user.getEmail(), user.getDisplayName(),
                roles.stream().sorted(Comparator.naturalOrder()).toList(), user.getStatus(),
                user.isEmailVerified(), user.getCreatedAt(), user.getSuspendedAt(), user.getSuspendedBy(),
                user.getSuspensionReason(), user.getSuspendedUntil());
    }
}

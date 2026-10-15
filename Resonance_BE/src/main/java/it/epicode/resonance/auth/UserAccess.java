package it.epicode.resonance.auth;

import it.epicode.resonance.user.Role;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/**
 * Stato e ruoli di un utente letti dal database. Motivo e scadenza della sospensione sono valorizzati
 * solo con stato SUSPENDED (suspendedUntil nullo = a tempo indeterminato); per NOT_FOUND userId e'
 * quello cercato e i ruoli sono vuoti.
 */
public record UserAccess(UUID userId, AccessStatus status, Set<Role> roles, String suspensionReason,
                         Instant suspendedUntil) {

    public UserAccess {
        roles = roles == null ? Set.of() : Set.copyOf(roles);
    }

    /**
     * True se l'utente puo' usare l'API: esiste, ha l'email verificata e non e' sospeso.
     */
    public boolean isActive() {
        return status == AccessStatus.ACTIVE;
    }
}

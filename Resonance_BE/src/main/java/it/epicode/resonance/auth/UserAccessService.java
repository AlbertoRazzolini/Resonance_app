package it.epicode.resonance.auth;

import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.UserAccessRow;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Legge stato e ruoli di un utente dal database e applica la riattivazione pigra delle sospensioni
 * scadute (progettazione, sezioni 5.2 e 5.5). Lo usano il filtro JWT e, nelle card successive,
 * login, refresh e WebSocket: cosi' promozioni, revoche e sospensioni valgono dalla richiesta dopo.
 */
@Service
public class UserAccessService {

    private final UserRepository users;
    private final Clock clock;

    public UserAccessService(UserRepository users, Clock clock) {
        this.users = users;
        this.clock = clock;
    }

    /**
     * Stato di accesso dell'utente. Una sospensione con scadenza passata viene chiusa qui e l'utente
     * risulta ACTIVE. Il controllo dell'email viene prima di quello della sospensione, come nel
     * login (progettazione, sezione 4.7).
     */
    @Transactional
    public UserAccess resolve(UUID userId) {
        List<UserAccessRow> rows = users.findAccessRowsById(userId);
        if (rows.isEmpty()) {
            return new UserAccess(userId, AccessStatus.NOT_FOUND, Set.of(), null, null);
        }

        UserAccessRow first = rows.get(0);
        if (first.emailVerified() && isExpiredSuspension(first)) {
            // L'UPDATE e' atomico: se due richieste arrivano insieme vince una sola e l'esito e'
            // lo stesso. Si rilegge comunque lo stato, che puo' anche essere cambiato nel frattempo.
            users.reactivateIfExpired(userId, clock.instant());
            rows = users.findAccessRowsById(userId);
            if (rows.isEmpty()) {
                return new UserAccess(userId, AccessStatus.NOT_FOUND, Set.of(), null, null);
            }
            first = rows.get(0);
        }
        return toAccess(userId, first, rows);
    }

    private boolean isExpiredSuspension(UserAccessRow row) {
        return row.status() == UserStatus.SUSPENDED
                && row.suspendedUntil() != null
                && !row.suspendedUntil().isAfter(clock.instant());
    }

    private UserAccess toAccess(UUID userId, UserAccessRow first, List<UserAccessRow> rows) {
        Set<Role> roles = EnumSet.noneOf(Role.class);
        rows.stream().map(UserAccessRow::role).filter(Objects::nonNull).forEach(roles::add);

        if (!first.emailVerified()) {
            return new UserAccess(userId, AccessStatus.NOT_VERIFIED, roles, null, null);
        }
        if (first.status() == UserStatus.SUSPENDED) {
            return new UserAccess(userId, AccessStatus.SUSPENDED, roles, first.suspensionReason(), first.suspendedUntil());
        }
        return new UserAccess(userId, AccessStatus.ACTIVE, roles, null, null);
    }
}

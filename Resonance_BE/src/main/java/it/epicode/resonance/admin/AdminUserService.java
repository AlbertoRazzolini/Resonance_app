package it.epicode.resonance.admin;

import it.epicode.resonance.admin.dto.AdminUserResponse;
import it.epicode.resonance.admin.dto.SuspendUserRequest;
import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.auth.RefreshTokenService;
import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.LikePattern;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.user.PlatformLevelPolicy;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRoleId;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Operazioni degli amministratori sugli utenti (progettazione, sezioni 5.4-5.6): elenco, sospensione e
 * riattivazione, nomina e revoca degli ADMIN. Le operazioni di modifica bloccano la riga dell'utente e
 * applicano la regola dei livelli prima di cambiarla.
 */
@Service
public class AdminUserService {

    private final UserRepository users;
    private final UserRoleRepository userRoles;
    private final PlatformLevelPolicy policy;
    private final RefreshTokenService refreshTokens;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public AdminUserService(UserRepository users, UserRoleRepository userRoles, PlatformLevelPolicy policy,
                            RefreshTokenService refreshTokens, ApplicationEventPublisher events, Clock clock) {
        this.users = users;
        this.userRoles = userRoles;
        this.policy = policy;
        this.refreshTokens = refreshTokens;
        this.events = events;
        this.clock = clock;
    }

    /**
     * Elenco paginato degli utenti (progettazione, sezione 6.10). La ricerca cerca il testo in email e nome senza
     * distinguere le maiuscole, con % e _ trattati come caratteri normali; il filtro sullo stato e' facoltativo.
     * Ordine fisso: dal piu' recente, a parita' per id decrescente.
     */
    @Transactional(readOnly = true)
    public PageResponse<AdminUserResponse> list(String search, UserStatus status, PageParams params) {
        Specification<User> filters = (root, query, cb) -> {
            List<Predicate> conditions = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String pattern = "%" + LikePattern.escape(search.strip().toLowerCase(Locale.ROOT)) + "%";
                conditions.add(cb.or(
                        cb.like(cb.lower(root.get("email")), pattern, '\\'),
                        cb.like(cb.lower(root.get("displayName")), pattern, '\\')));
            }
            if (status != null) {
                conditions.add(cb.equal(root.get("status"), status));
            }
            return cb.and(conditions.toArray(new Predicate[0]));
        };
        Page<User> page = users.findAll(filters,
                params.toPageable(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));

        // Un'unica query per i ruoli di tutta la pagina, non una per utente.
        Map<UUID, List<Role>> rolesByUser = userRoles
                .findByIdUserIdIn(page.getContent().stream().map(User::getId).toList()).stream()
                .collect(Collectors.groupingBy(r -> r.getId().getUserId(),
                        Collectors.mapping(r -> r.getId().getRole(), Collectors.toList())));
        return PageResponse.from(page.map(user ->
                AdminUserResponse.from(user, rolesByUser.getOrDefault(user.getId(), List.of()))));
    }

    /**
     * Sospende un utente (progettazione, sezione 5.5): lock, regola dei livelli, controllo dell'ultimo
     * SUPERADMIN, stato e dati di sospensione, revoca di tutti i refresh token ed evento. Su un utente gia'
     * sospeso aggiorna i dettagli (per esempio per prolungare la sospensione).
     */
    @Transactional
    public AdminUserResponse suspend(UUID targetId, SuspendUserRequest request, AuthenticatedUser admin) {
        User target = lockUser(targetId);
        Set<Role> targetRoles = userRoles.findRolesByUserId(targetId);
        policy.requireCanActOn(admin.id(), admin.roles(), targetId, targetRoles);
        requireNotLastSuperadmin(targetId, targetRoles);

        Instant now = clock.instant();
        target.setStatus(UserStatus.SUSPENDED);
        target.setSuspendedAt(now);
        target.setSuspendedBy(admin.id());
        target.setSuspensionReason(request.reason());
        target.setSuspendedUntil(endOf(request, now));
        users.save(target);

        refreshTokens.revokeAll(targetId);
        // Dopo il commit chiude le sessioni WebSocket dell'utente (sezione 5.5).
        events.publishEvent(new UserSuspendedEvent(targetId));
        return AdminUserResponse.from(target, targetRoles);
    }

    /**
     * Riattivazione manuale anticipata (progettazione, sezione 5.5). Idempotente: su un utente attivo non cambia nulla.
     */
    @Transactional
    public AdminUserResponse reactivate(UUID targetId, AuthenticatedUser admin) {
        User target = lockUser(targetId);
        Set<Role> targetRoles = userRoles.findRolesByUserId(targetId);
        policy.requireCanActOn(admin.id(), admin.roles(), targetId, targetRoles);

        if (target.getStatus() == UserStatus.SUSPENDED) {
            target.setStatus(UserStatus.ACTIVE);
            target.setSuspendedAt(null);
            target.setSuspendedBy(null);
            target.setSuspensionReason(null);
            target.setSuspendedUntil(null);
            users.save(target);
        }
        return AdminUserResponse.from(target, targetRoles);
    }

    /**
     * Nomina un ADMIN (progettazione, sezione 5.4): utente verificato e non sospeso, regola dei livelli.
     * Idempotente. Non revoca token: i ruoli si leggono dal database a ogni richiesta (sezione 5.2).
     */
    @Transactional
    public AdminUserResponse grantAdmin(UUID targetId, AuthenticatedUser superadmin) {
        User target = lockUser(targetId);
        Set<Role> targetRoles = userRoles.findRolesByUserId(targetId);
        policy.requireCanActOn(superadmin.id(), superadmin.roles(), targetId, targetRoles);
        if (!target.isEmailVerified()) {
            throw new AppException(ErrorCode.USER_NOT_VERIFIED, "L'utente non ha verificato l'email");
        }
        if (isSuspendedNow(target)) {
            throw new AppException(ErrorCode.USER_NOT_ACTIVE, "L'utente e' sospeso");
        }
        userRoles.addIfAbsent(targetId, Role.ADMIN.name());
        return AdminUserResponse.from(target, userRoles.findRolesByUserId(targetId));
    }

    /**
     * Revoca il ruolo ADMIN (progettazione, sezione 5.4), con la regola dei livelli. Idempotente. Non richiede
     * che l'utente sia attivo: un admin sospeso si puo' sempre revocare.
     */
    @Transactional
    public AdminUserResponse revokeAdmin(UUID targetId, AuthenticatedUser superadmin) {
        User target = lockUser(targetId);
        Set<Role> targetRoles = userRoles.findRolesByUserId(targetId);
        policy.requireCanActOn(superadmin.id(), superadmin.roles(), targetId, targetRoles);
        userRoles.deleteById(new UserRoleId(targetId, Role.ADMIN));
        return AdminUserResponse.from(target, userRoles.findRolesByUserId(targetId));
    }

    /**
     * Sospeso adesso: stato SUSPENDED e scadenza assente o ancora futura. Una scadenza passata non conta,
     * anche se la riattivazione pigra non ha ancora chiuso la riga (sezione 5.5).
     */
    private boolean isSuspendedNow(User user) {
        return user.getStatus() == UserStatus.SUSPENDED
                && (user.getSuspendedUntil() == null || user.getSuspendedUntil().isAfter(clock.instant()));
    }

    /**
     * Fine della sospensione: la data indicata, oppure ora piu' la durata in giorni; senza nessuno dei due
     * la sospensione e' indeterminata (null).
     */
    private static Instant endOf(SuspendUserRequest request, Instant now) {
        if (request.suspendedUntil() != null) {
            return request.suspendedUntil();
        }
        return request.durationDays() == null ? null : now.plus(Duration.ofDays(request.durationDays()));
    }

    /**
     * Difesa aggiuntiva (progettazione, sezione 5.5): non si sospende l'ultimo SUPERADMIN attivo. Oggi la
     * regola dei livelli lo impedisce gia', ma il sistema non deve restare senza amministratore supremo.
     */
    private void requireNotLastSuperadmin(UUID targetId, Set<Role> targetRoles) {
        if (targetRoles.contains(Role.SUPERADMIN)
                && users.countByRoleAndStatusExcluding(Role.SUPERADMIN, UserStatus.ACTIVE, targetId) == 0) {
            throw new AppException(ErrorCode.LAST_SUPERADMIN, "Non si puo' sospendere l'ultimo SUPERADMIN");
        }
    }

    private User lockUser(UUID id) {
        return users.findWithLockById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Utente non trovato"));
    }
}

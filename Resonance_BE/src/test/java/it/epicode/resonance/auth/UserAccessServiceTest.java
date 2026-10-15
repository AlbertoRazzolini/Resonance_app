package it.epicode.resonance.auth;

import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Stato e ruoli di un utente letti dal database, con la riattivazione pigra delle sospensioni
 * scadute (progettazione, sezioni 5.2 e 5.5).
 */
class UserAccessServiceTest extends IntegrationTest {

    @Autowired
    private UserAccessService service;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    private User moderator;

    @BeforeEach
    void createModerator() {
        // La sospensione richiede un autore (ck_users_suspension e fk_users_suspended_by).
        moderator = users.save(new User("admin@example.com", "hash-di-prova", "Admin"));
    }

    @Test
    void resolve_unknownUser_isNotFound() {
        UserAccess access = service.resolve(UUID.randomUUID());

        assertThat(access.status()).isEqualTo(AccessStatus.NOT_FOUND);
        assertThat(access.roles()).isEmpty();
    }

    @Test
    void resolve_unverifiedUser_isNotVerified() {
        User user = users.save(new User("nuovo@example.com", "hash-di-prova", "Nuovo"));

        assertThat(service.resolve(user.getId()).status()).isEqualTo(AccessStatus.NOT_VERIFIED);
    }

    @Test
    void resolve_activeUser_returnsAllRolesFromDatabase() {
        User user = verifiedUser("mario@example.com");
        roles.save(new UserRole(user.getId(), Role.FAN));
        roles.save(new UserRole(user.getId(), Role.MUSICIAN));

        UserAccess access = service.resolve(user.getId());

        assertThat(access.status()).isEqualTo(AccessStatus.ACTIVE);
        assertThat(access.userId()).isEqualTo(user.getId());
        assertThat(access.roles()).containsExactlyInAnyOrder(Role.FAN, Role.MUSICIAN);
    }

    @Test
    void resolve_activeUserWithoutRoles_hasEmptyRoleSet() {
        User user = verifiedUser("senza@example.com");

        UserAccess access = service.resolve(user.getId());

        assertThat(access.status()).isEqualTo(AccessStatus.ACTIVE);
        assertThat(access.roles()).isEmpty();
    }

    @Test
    void resolve_roleGrantedAfterFirstRead_isSeenOnNextRead() {
        User user = verifiedUser("promosso@example.com");
        roles.save(new UserRole(user.getId(), Role.FAN));
        assertThat(service.resolve(user.getId()).roles()).containsExactly(Role.FAN);

        roles.save(new UserRole(user.getId(), Role.ADMIN));

        assertThat(service.resolve(user.getId()).roles()).containsExactlyInAnyOrder(Role.FAN, Role.ADMIN);
    }

    @Test
    void resolve_suspendedUntilInTheFuture_isSuspendedWithDetails() {
        Instant until = clock.instant().plus(Duration.ofDays(3));
        User user = suspendedUser("sospeso@example.com", until);

        UserAccess access = service.resolve(user.getId());

        assertThat(access.status()).isEqualTo(AccessStatus.SUSPENDED);
        assertThat(access.suspensionReason()).isEqualTo("Linguaggio offensivo");
        // PostgreSQL salva i microsecondi: il confronto ammette la differenza di arrotondamento.
        assertThat(access.suspendedUntil()).isCloseTo(until, within(1, ChronoUnit.MILLIS));
    }

    @Test
    void resolve_suspendedWithoutEnd_staysSuspended() {
        User user = suspendedUser("indeterminato@example.com", null);

        clock.advance(Duration.ofDays(3650));

        UserAccess access = service.resolve(user.getId());
        assertThat(access.status()).isEqualTo(AccessStatus.SUSPENDED);
        assertThat(access.suspendedUntil()).isNull();
    }

    @Test
    void resolve_suspensionExpired_reactivatesUserAndUpdatesRow() {
        User user = suspendedUser("scaduto@example.com", clock.instant().plus(Duration.ofDays(1)));

        clock.advance(Duration.ofDays(2));
        UserAccess access = service.resolve(user.getId());

        assertThat(access.status()).isEqualTo(AccessStatus.ACTIVE);
        assertThat(access.suspensionReason()).isNull();
        assertThat(access.suspendedUntil()).isNull();
        // La riga e' stata aggiornata davvero, con tutti i campi di sospensione azzerati.
        User row = users.findById(user.getId()).orElseThrow();
        assertThat(row.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(row.getSuspendedAt()).isNull();
        assertThat(row.getSuspendedBy()).isNull();
        assertThat(row.getSuspensionReason()).isNull();
        assertThat(row.getSuspendedUntil()).isNull();
    }

    @Test
    void resolve_suspensionEndingExactlyNow_reactivatesUser() {
        // Il confronto e' "suspended_until <= adesso": all'istante esatto la sospensione e' finita.
        // Troncato ai secondi: PostgreSQL salva i microsecondi e arrotonda, quindi un istante con i
        // nanosecondi tornerebbe dal database leggermente diverso e il test sarebbe instabile.
        Instant until = clock.instant().plus(Duration.ofHours(1)).truncatedTo(ChronoUnit.SECONDS);
        User user = suspendedUser("limite@example.com", until);

        clock.setInstant(until);

        assertThat(service.resolve(user.getId()).status()).isEqualTo(AccessStatus.ACTIVE);
    }

    @Test
    void resolve_suspendedAndUnverified_isNotVerifiedBeforeSuspended() {
        // Stesso ordine del login (progettazione, sezione 4.7): l'email non verificata viene prima della sospensione.
        User user = suspendedUser("entrambi@example.com", clock.instant().plus(Duration.ofDays(3)));
        user.setEmailVerified(false);
        users.save(user);

        UserAccess access = service.resolve(user.getId());

        assertThat(access.status()).isEqualTo(AccessStatus.NOT_VERIFIED);
        assertThat(access.suspensionReason()).isNull();
    }

    @Test
    void resolve_unverifiedWithExpiredSuspension_isNotReactivated() {
        User user = suspendedUser("nonverificato@example.com", clock.instant().plus(Duration.ofDays(1)));
        user.setEmailVerified(false);
        users.save(user);

        clock.advance(Duration.ofDays(2));

        assertThat(service.resolve(user.getId()).status()).isEqualTo(AccessStatus.NOT_VERIFIED);
        // La riattivazione pigra riguarda solo chi ha l'email verificata: la riga resta com'era.
        assertThat(users.findById(user.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.SUSPENDED);
    }

    private User verifiedUser(String email) {
        User user = new User(email, "hash-di-prova", "Utente");
        user.setEmailVerified(true);
        return users.save(user);
    }

    private User suspendedUser(String email, Instant until) {
        User user = new User(email, "hash-di-prova", "Utente");
        user.setEmailVerified(true);
        user.setStatus(UserStatus.SUSPENDED);
        user.setSuspendedAt(clock.instant());
        user.setSuspendedBy(moderator.getId());
        user.setSuspensionReason("Linguaggio offensivo");
        user.setSuspendedUntil(until);
        return users.save(user);
    }
}

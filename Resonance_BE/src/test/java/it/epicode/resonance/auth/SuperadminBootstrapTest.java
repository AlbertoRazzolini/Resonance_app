package it.epicode.resonance.auth;

import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Bootstrap del primo SUPERADMIN (progettazione, sezione 4.12), chiamando direttamente {@code run} con le
 * credenziali del caso: idempotente, senza azioni se le variabili mancano e senza mai scrivere la password
 * nel log.
 */
@ExtendWith(OutputCaptureExtension.class)
class SuperadminBootstrapTest extends IntegrationTest {

    private static final String EMAIL = "root@example.com";
    private static final String PASSWORD = "password-segreta-1";

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void run_withoutAnySuperadminAndWithCredentials_createsAVerifiedActiveUserWithFanAndSuperadmin() {
        bootstrap(EMAIL, PASSWORD).run(null);

        User user = users.findByEmail(EMAIL).orElseThrow();
        assertThat(user.isEmailVerified()).isTrue();
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(user.getDisplayName()).isEqualTo("Superadmin");
        assertThat(passwordEncoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
        assertThat(roles.findRolesByUserId(user.getId())).containsExactlyInAnyOrder(Role.FAN, Role.SUPERADMIN);
    }

    @Test
    void run_normalizesTheEmailFromTheEnvironment() {
        bootstrap("  Root@Example.COM ", PASSWORD).run(null);

        assertThat(users.findByEmail(EMAIL)).isPresent();
    }

    @Test
    void run_twice_changesNothingTheSecondTime() {
        bootstrap(EMAIL, PASSWORD).run(null);
        User first = users.findByEmail(EMAIL).orElseThrow();

        // Anche con una password diversa: il secondo avvio non deve toccare un SUPERADMIN gia' esistente.
        bootstrap(EMAIL, "un-altra-password-2").run(null);

        User second = users.findByEmail(EMAIL).orElseThrow();
        assertThat(users.count()).isEqualTo(1);
        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(second.getPasswordHash()).isEqualTo(first.getPasswordHash());
        assertThat(roles.findRolesByUserId(second.getId())).containsExactlyInAnyOrder(Role.FAN, Role.SUPERADMIN);
    }

    @Test
    void run_whenAnotherUserIsAlreadySuperadmin_doesNothing() {
        User other = users.save(new User("altro@example.com", "hash-di-prova", "Altro"));
        roles.save(new UserRole(other.getId(), Role.SUPERADMIN));

        bootstrap(EMAIL, PASSWORD).run(null);

        assertThat(users.findByEmail(EMAIL)).isEmpty();
        assertThat(users.count()).isEqualTo(1);
    }

    @Test
    void run_withMissingVariables_doesNothingAndLogsAWarning(CapturedOutput output) {
        bootstrap("", "").run(null);
        bootstrap(EMAIL, "").run(null);
        bootstrap("", PASSWORD).run(null);

        assertThat(users.count()).isZero();
        assertThat(output.getAll()).contains("SUPERADMIN_EMAIL").contains("SUPERADMIN_PASSWORD");
    }

    @Test
    void run_withAnExistingUserEmail_addsTheRoleVerifiesTheUserAndSetsThePassword() {
        User existing = users.save(new User(EMAIL, passwordEncoder.encode("vecchia-password"), "Mario"));
        roles.save(new UserRole(existing.getId(), Role.MUSICIAN));

        bootstrap(EMAIL, PASSWORD).run(null);

        User user = users.findByEmail(EMAIL).orElseThrow();
        assertThat(user.getId()).isEqualTo(existing.getId());
        assertThat(user.isEmailVerified()).isTrue();
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(passwordEncoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
        // Il nome scelto dall'utente non si cambia; FAN si aggiunge perche' mancava, MUSICIAN resta.
        assertThat(user.getDisplayName()).isEqualTo("Mario");
        assertThat(roles.findRolesByUserId(user.getId()))
                .containsExactlyInAnyOrder(Role.FAN, Role.MUSICIAN, Role.SUPERADMIN);
    }

    @Test
    void run_withASuspendedExistingUser_reactivatesItAndClearsTheSuspension() {
        User moderator = users.save(new User("admin@example.com", "hash-di-prova", "Admin"));
        User suspended = users.save(new User(EMAIL, passwordEncoder.encode("vecchia-password"), "Mario"));
        suspended.setStatus(UserStatus.SUSPENDED);
        suspended.setSuspendedAt(clock.instant());
        suspended.setSuspendedBy(moderator.getId());
        suspended.setSuspensionReason("Linguaggio offensivo");
        users.save(suspended);

        bootstrap(EMAIL, PASSWORD).run(null);

        User user = users.findByEmail(EMAIL).orElseThrow();
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(user.getSuspendedAt()).isNull();
        assertThat(user.getSuspendedBy()).isNull();
        assertThat(user.getSuspensionReason()).isNull();
        assertThat(user.getSuspendedUntil()).isNull();
    }

    @Test
    void run_withAPasswordOfFiveCharacters_failsTheStartupAndCreatesNothing() {
        assertThatThrownBy(() -> bootstrap(EMAIL, "12345").run(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SUPERADMIN_PASSWORD")
                // Il messaggio dice cosa non va, ma non riporta la password.
                .hasMessageNotContaining("12345");

        assertThat(users.count()).isZero();
    }

    @Test
    void run_withAPasswordOver72Bytes_failsTheStartup() {
        // 30 emoji: 30 caratteri ma 120 byte in UTF-8, oltre il limite di BCrypt.
        assertThatThrownBy(() -> bootstrap(EMAIL, "😀".repeat(30)).run(null))
                .isInstanceOf(IllegalStateException.class);

        assertThat(users.count()).isZero();
    }

    @Test
    void run_neverWritesThePasswordInTheLog(CapturedOutput output) {
        // Prima il caso di errore (nessun SUPERADMIN ancora), poi la creazione e il secondo avvio.
        assertThatThrownBy(() -> bootstrap("altro@example.com", "123456").run(null))
                .isInstanceOf(IllegalStateException.class);
        bootstrap(EMAIL, PASSWORD).run(null);
        bootstrap(EMAIL, PASSWORD).run(null);

        assertThat(output.getAll()).doesNotContain(PASSWORD).doesNotContain("123456");
    }

    private SuperadminBootstrap bootstrap(String email, String password) {
        return new SuperadminBootstrap(users, roles, passwordEncoder, email, password);
    }
}

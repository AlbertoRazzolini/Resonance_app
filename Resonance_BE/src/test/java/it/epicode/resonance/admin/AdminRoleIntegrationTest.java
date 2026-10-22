package it.epicode.resonance.admin;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Nomina e revoca degli ADMIN riservate al SUPERADMIN (progettazione, sezioni 5.4 e 5.6): efficaci subito con il
 * token gia' emesso (i ruoli si leggono dal database), idempotenti, con le verifiche su email e stato.
 */
class AdminRoleIntegrationTest extends IntegrationTest {

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private AccessTokenService accessTokens;

    // ---------------------------------------------------------------- nomina

    @Test
    void appoint_addsAdmin_andKeepsCommunityRoles() throws Exception {
        User superadmin = userWith(Role.SUPERADMIN);
        User target = userWith(Role.MUSICIAN);

        appoint(superadmin, target)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(target.getId().toString()))
                .andExpect(jsonPath("$.roles", contains("FAN", "MUSICIAN", "ADMIN")));

        assertThat(roles.findRolesByUserId(target.getId()))
                .containsExactlyInAnyOrder(Role.FAN, Role.MUSICIAN, Role.ADMIN);
    }

    @Test
    void appoint_takesEffectImmediately_withTheTokenAlreadyIssued() throws Exception {
        User superadmin = userWith(Role.SUPERADMIN);
        User target = userWith();
        User someone = userWith();
        String token = bearer(target);

        // Prima della nomina l'area admin e' vietata...
        mockMvc.perform(delete("/api/admin/users/{id}/suspension", someone.getId()).header("Authorization", token))
                .andExpect(status().isForbidden());

        appoint(superadmin, target).andExpect(status().isOk());

        // ...dopo, lo stesso token entra: il ruolo viene dal database, non dal JWT (sezione 5.2).
        mockMvc.perform(delete("/api/admin/users/{id}/suspension", someone.getId()).header("Authorization", token))
                .andExpect(status().isOk());
    }

    @Test
    void appoint_isIdempotent() throws Exception {
        User superadmin = userWith(Role.SUPERADMIN);
        User target = userWith();

        for (int i = 0; i < 2; i++) {
            appoint(superadmin, target)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.roles", contains("FAN", "ADMIN")));
        }

        assertThat(roles.findAll()).filteredOn(r -> r.getId().getUserId().equals(target.getId())).hasSize(2);
    }

    @Test
    void appoint_unverifiedUser_returns409() throws Exception {
        User superadmin = userWith(Role.SUPERADMIN);
        User target = userWith();
        target.setEmailVerified(false);
        users.save(target);

        appoint(superadmin, target)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USER_NOT_VERIFIED"));

        assertThat(roles.findRolesByUserId(target.getId())).doesNotContain(Role.ADMIN);
    }

    @Test
    void appoint_suspendedUser_returns409_butExpiredSuspensionDoesNotCount() throws Exception {
        User superadmin = userWith(Role.SUPERADMIN);
        User indefinite = suspended(userWith(), null);
        User expired = suspended(userWith(), clock.instant().minus(Duration.ofHours(1)));

        appoint(superadmin, indefinite)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USER_NOT_ACTIVE"));
        // Una sospensione scaduta e' di fatto finita, anche se nessuno l'ha ancora chiusa (sezione 5.5).
        appoint(superadmin, expired).andExpect(status().isOk());

        assertThat(roles.findRolesByUserId(indefinite.getId())).doesNotContain(Role.ADMIN);
    }

    @Test
    void appoint_oneself_returns403() throws Exception {
        User superadmin = userWith(Role.SUPERADMIN);

        appoint(superadmin, superadmin)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_PLATFORM_LEVEL"));
    }

    @Test
    void appoint_onAnotherSuperadmin_returns403() throws Exception {
        User superadmin = userWith(Role.SUPERADMIN);
        User other = userWith(Role.SUPERADMIN);

        appoint(superadmin, other)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_PLATFORM_LEVEL"));
    }

    @Test
    void appoint_unknownUser_returns404() throws Exception {
        User superadmin = userWith(Role.SUPERADMIN);

        mockMvc.perform(post("/api/superadmin/users/{id}/admin", UUID.randomUUID())
                        .header("Authorization", bearer(superadmin)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    // ---------------------------------------------------------------- revoca

    @Test
    void revoke_removesAdmin_andTakesEffectImmediately() throws Exception {
        User superadmin = userWith(Role.SUPERADMIN);
        User admin = userWith(Role.ADMIN);
        User someone = userWith();
        String adminToken = bearer(admin);
        mockMvc.perform(delete("/api/admin/users/{id}/suspension", someone.getId()).header("Authorization", adminToken))
                .andExpect(status().isOk());

        revoke(superadmin, admin)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles", contains("FAN")));

        // Stesso token di prima: ora l'area admin e' vietata.
        mockMvc.perform(delete("/api/admin/users/{id}/suspension", someone.getId()).header("Authorization", adminToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void revoke_isIdempotent_onAUserWhoIsNotAdmin() throws Exception {
        User superadmin = userWith(Role.SUPERADMIN);
        User target = userWith();

        for (int i = 0; i < 2; i++) {
            revoke(superadmin, target)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.roles", contains("FAN")));
        }
    }

    @Test
    void revoke_suspendedAdmin_isAllowed() throws Exception {
        User superadmin = userWith(Role.SUPERADMIN);
        User admin = suspended(userWith(Role.ADMIN), null);

        // La verifica "attivo" riguarda solo la nomina: un admin sospeso si puo' sempre revocare.
        revoke(superadmin, admin).andExpect(status().isOk());

        assertThat(roles.findRolesByUserId(admin.getId())).doesNotContain(Role.ADMIN);
    }

    @Test
    void revoke_oneself_returns403_andOnSuperadmin_returns403() throws Exception {
        User superadmin = userWith(Role.SUPERADMIN);
        User other = userWith(Role.SUPERADMIN);

        revoke(superadmin, superadmin)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_PLATFORM_LEVEL"));
        revoke(superadmin, other)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_PLATFORM_LEVEL"));

        assertThat(roles.findRolesByUserId(other.getId())).contains(Role.SUPERADMIN);
    }

    // ---------------------------------------------------------------- accesso

    @Test
    void superadminArea_asAdmin_returns403() throws Exception {
        User admin = userWith(Role.ADMIN);
        User target = userWith();

        appoint(admin, target)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        revoke(admin, target)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        assertThat(roles.findRolesByUserId(target.getId())).doesNotContain(Role.ADMIN);
    }

    @Test
    void superadminArea_asFan_returns403_andWithoutToken_returns401() throws Exception {
        User fan = userWith();
        User target = userWith();

        appoint(fan, target).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/superadmin/users/{id}/admin", target.getId()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/superadmin/users/{id}/admin", target.getId()))
                .andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------------------------- supporto

    private ResultActions appoint(User actor, User target) throws Exception {
        return mockMvc.perform(post("/api/superadmin/users/{id}/admin", target.getId())
                .header("Authorization", bearer(actor)));
    }

    private ResultActions revoke(User actor, User target) throws Exception {
        return mockMvc.perform(delete("/api/superadmin/users/{id}/admin", target.getId())
                .header("Authorization", bearer(actor)));
    }

    /**
     * Crea un utente verificato con FAN piu' i ruoli indicati.
     */
    private User userWith(Role... extraRoles) {
        User user = new User("utente-" + UUID.randomUUID() + "@example.com", "hash-di-prova", "Utente " + UUID.randomUUID());
        user.setEmailVerified(true);
        users.save(user);
        roles.save(new UserRole(user.getId(), Role.FAN));
        for (Role role : extraRoles) {
            roles.save(new UserRole(user.getId(), role));
        }
        return user;
    }

    private User suspended(User user, java.time.Instant until) {
        // La sospensione richiede un autore (ck_users_suspension e fk_users_suspended_by).
        User moderator = users.save(new User("mod-" + UUID.randomUUID() + "@example.com", "hash-di-prova", "Mod " + UUID.randomUUID()));
        user.setStatus(UserStatus.SUSPENDED);
        user.setSuspendedAt(clock.instant());
        user.setSuspendedBy(moderator.getId());
        user.setSuspensionReason("Spam");
        user.setSuspendedUntil(until);
        return users.save(user);
    }

    private String bearer(User user) {
        return "Bearer " + accessTokens.issue(user.getId()).token();
    }
}

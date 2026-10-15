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
import org.springframework.context.annotation.Import;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Catena di sicurezza completa con MockMvc e database reale (progettazione, sezioni 5.2, 6.3 e 8.2):
 * 401 e 403 in JSON, ruoli e stato letti dal database a ogni richiesta (una promozione vale subito,
 * anche con il token gia' emesso) e percorsi /api inesistenti che rispondono sempre 404.
 */
@Import(JwtFilterIntegrationTest.ProbeController.class)
class JwtFilterIntegrationTest extends IntegrationTest {

    /**
     * Controller presente solo nei test: un endpoint che richiede il login e uno sotto /api/admin/**.
     */
    @RestController
    static class ProbeController {

        @GetMapping("/api/test/me")
        Map<String, Object> me(@AuthenticationPrincipal AuthenticatedUser user) {
            return Map.of("id", user.id().toString(), "roles", user.roles());
        }

        @GetMapping("/api/admin/test")
        Map<String, String> admin() {
            return Map.of("result", "ok");
        }
    }

    @Autowired
    private AccessTokenService accessTokens;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    private User moderator;

    @BeforeEach
    void createModerator() {
        // Autore delle sospensioni (fk_users_suspended_by).
        moderator = users.save(new User("moderator@example.com", "hash-di-prova", "Moderatore"));
    }

    // ---- 401: autenticazione assente o non valida ----

    @Test
    void protectedEndpoint_withoutToken_returns401Json() throws Exception {
        mockMvc.perform(get("/api/test/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.fields").isMap())
                .andExpect(jsonPath("$.details").isMap());
    }

    @Test
    void protectedEndpoint_withMalformedToken_returns401() throws Exception {
        mockMvc.perform(get("/api/test/me").header("Authorization", "Bearer non-un-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void protectedEndpoint_withNonBearerScheme_returns401() throws Exception {
        User user = activeUser("basic@example.com", Role.FAN);

        mockMvc.perform(get("/api/test/me").header("Authorization", "Basic " + tokenFor(user)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpoint_withExpiredToken_returns401() throws Exception {
        User user = activeUser("scaduto@example.com", Role.FAN);
        String token = tokenFor(user);

        clock.advance(Duration.ofMinutes(16));

        mockMvc.perform(get("/api/test/me").header("Authorization", bearer(token)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void protectedEndpoint_withTokenOfUnknownUser_returns401() throws Exception {
        String token = accessTokens.issue(UUID.randomUUID()).token();

        mockMvc.perform(get("/api/test/me").header("Authorization", bearer(token)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpoint_withUnverifiedUser_returns401() throws Exception {
        User user = users.save(new User("nonverificato@example.com", "hash-di-prova", "Non verificato"));

        mockMvc.perform(get("/api/test/me").header("Authorization", bearer(tokenFor(user))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpoint_withSuspendedUser_returns401() throws Exception {
        User user = suspendedUser("sospeso@example.com", clock.instant().plus(Duration.ofDays(3)));

        mockMvc.perform(get("/api/test/me").header("Authorization", bearer(tokenFor(user))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void protectedEndpoint_afterSuspensionExpired_userIsReactivatedAndAllowed() throws Exception {
        User user = suspendedUser("riattivato@example.com", clock.instant().plus(Duration.ofDays(1)));
        roles.save(new UserRole(user.getId(), Role.FAN));
        String oldToken = tokenFor(user);

        // Dopo la fine della sospensione la riattivazione pigra avviene nel filtro (progettazione,
        // sezione 5.5). Il token emesso prima e' scaduto (15 minuti): serve il refresh, quindi se ne emette uno nuovo.
        clock.advance(Duration.ofDays(2));
        String freshToken = tokenFor(user);

        mockMvc.perform(get("/api/test/me").header("Authorization", bearer(freshToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(user.getId().toString()));
        mockMvc.perform(get("/api/test/me").header("Authorization", bearer(oldToken)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpoint_withValidToken_exposesIdAndRolesFromDatabase() throws Exception {
        User user = activeUser("mario@example.com", Role.FAN, Role.MUSICIAN);

        mockMvc.perform(get("/api/test/me").header("Authorization", bearer(tokenFor(user))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(user.getId().toString()))
                .andExpect(jsonPath("$.roles", containsInAnyOrder("FAN", "MUSICIAN")));
    }

    // ---- 403: ruoli ----

    @Test
    void adminEndpoint_withFanUser_returns403Json() throws Exception {
        User user = activeUser("fan@example.com", Role.FAN);

        mockMvc.perform(get("/api/admin/test").header("Authorization", bearer(tokenFor(user))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void adminEndpoint_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/admin/test"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void adminEndpoint_userPromotedAfterTokenIssued_isAllowedWithTheSameToken() throws Exception {
        User user = activeUser("promosso@example.com", Role.FAN);
        String token = tokenFor(user);
        mockMvc.perform(get("/api/admin/test").header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());

        // Ruoli letti dal database a ogni richiesta, non dal token (progettazione, sezione 5.2).
        roles.save(new UserRole(user.getId(), Role.ADMIN));

        mockMvc.perform(get("/api/admin/test").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value("ok"));
    }

    @Test
    void adminEndpoint_adminRevokedAfterTokenIssued_isDeniedWithTheSameToken() throws Exception {
        User user = activeUser("revocato@example.com", Role.FAN, Role.ADMIN);
        String token = tokenFor(user);
        mockMvc.perform(get("/api/admin/test").header("Authorization", bearer(token)))
                .andExpect(status().isOk());

        roles.deleteById(new UserRole(user.getId(), Role.ADMIN).getId());

        mockMvc.perform(get("/api/admin/test").header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminEndpoint_withSuperadmin_isAllowedByRoleHierarchy() throws Exception {
        // Il SUPERADMIN ha solo la propria riga di ruolo: l'accesso a /api/admin/** viene dalla gerarchia.
        User user = activeUser("super@example.com", Role.SUPERADMIN);

        mockMvc.perform(get("/api/admin/test").header("Authorization", bearer(tokenFor(user))))
                .andExpect(status().isOk());
    }

    @Test
    void adminEndpoint_afterAdminIsSuspended_returns401() throws Exception {
        User user = activeUser("adminsospeso@example.com", Role.ADMIN);
        String token = tokenFor(user);
        mockMvc.perform(get("/api/admin/test").header("Authorization", bearer(token)))
                .andExpect(status().isOk());

        user.setStatus(UserStatus.SUSPENDED);
        user.setSuspendedAt(clock.instant());
        user.setSuspendedBy(moderator.getId());
        user.setSuspensionReason("Abuso dei poteri");
        users.save(user);

        mockMvc.perform(get("/api/admin/test").header("Authorization", bearer(token)))
                .andExpect(status().isUnauthorized());
    }

    // ---- endpoint pubblici e token vecchi ----

    @Test
    void publicEndpoint_withInvalidOrExpiredToken_stillWorks() throws Exception {
        User user = activeUser("vecchio@example.com", Role.FAN);
        String token = tokenFor(user);
        clock.advance(Duration.ofMinutes(16));

        // Un token rimasto nel frontend non deve bloccare le pagine pubbliche (progettazione, sezione 8.2).
        mockMvc.perform(get("/api/health").header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/health").header("Authorization", "Bearer spazzatura"))
                .andExpect(status().isOk());
    }

    // ---- percorsi inesistenti e metodi sbagliati ----

    @Test
    void unknownApiPath_withoutToken_returns404Json() throws Exception {
        mockMvc.perform(get("/api/inesistente"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void unknownApiPathUnderAdmin_withoutToken_returns404NotAuthError() throws Exception {
        mockMvc.perform(get("/api/admin/inesistente"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(get("/api/superadmin/inesistente"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void unknownApiPath_withInvalidToken_returns404() throws Exception {
        mockMvc.perform(get("/api/inesistente").header("Authorization", "Bearer spazzatura"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void unknownApiPath_withAnyMethod_returns404() throws Exception {
        mockMvc.perform(post("/api/inesistente"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void wrongMethodOnProtectedExistingPath_withoutToken_returns401NotMethodNotAllowed() throws Exception {
        // Il percorso esiste (solo GET): senza token vale la regola normale, 401 prima del 405.
        mockMvc.perform(post("/api/test/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void wrongMethodOnPublicExistingPath_withoutToken_returns401NotMethodNotAllowed() throws Exception {
        // /api/health esiste ma e' pubblico solo per GET: con un altro metodo non e' "inesistente"
        // (niente 404) e non e' pubblico, quindi vale la regola normale (progettazione, sezione 6.3).
        mockMvc.perform(post("/api/health"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void wrongMethodOnAdminExistingPath_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/admin/test"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void wrongMethodOnProtectedExistingPath_withToken_returns405() throws Exception {
        User user = activeUser("metodo@example.com", Role.FAN);

        mockMvc.perform(post("/api/test/me").header("Authorization", bearer(tokenFor(user))))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    void wrongMethodOnAdminExistingPath_asFan_returns403() throws Exception {
        User user = activeUser("fan2@example.com", Role.FAN);

        mockMvc.perform(post("/api/admin/test").header("Authorization", bearer(tokenFor(user))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    // ---- supporto ----

    private User activeUser(String email, Role... userRoles) {
        User user = new User(email, "hash-di-prova", "Utente");
        user.setEmailVerified(true);
        users.save(user);
        for (Role role : userRoles) {
            roles.save(new UserRole(user.getId(), role));
        }
        return user;
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

    private String tokenFor(User user) {
        return accessTokens.issue(user.getId()).token();
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}

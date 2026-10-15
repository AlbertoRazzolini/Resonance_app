package it.epicode.resonance.user;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Attivazione self-service dei ruoli MUSICIAN e HOST (progettazione, sezione 5.3): ruoli additivi e
 * indipendenti, operazione idempotente, effetto immediato (ruoli letti dal database a ogni richiesta).
 */
class RoleActivationIntegrationTest extends IntegrationTest {

    @Autowired
    private AccessTokenService accessTokens;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Test
    void activateMusician_addsTheRole() throws Exception {
        User user = fan("fan@example.com");

        mockMvc.perform(post("/api/users/me/roles/musician").header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles", contains("FAN", "MUSICIAN")));

        assertThat(roles.findRolesByUserId(user.getId())).containsExactlyInAnyOrder(Role.FAN, Role.MUSICIAN);
    }

    @Test
    void activateMusicianThenHost_userHasAllThreeCommunityRoles() throws Exception {
        User user = fan("tutti@example.com");

        mockMvc.perform(post("/api/users/me/roles/musician").header("Authorization", bearer(user)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/users/me/roles/host").header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles", contains("FAN", "MUSICIAN", "HOST")));

        assertThat(roles.findRolesByUserId(user.getId()))
                .containsExactlyInAnyOrder(Role.FAN, Role.MUSICIAN, Role.HOST);
    }

    @Test
    void activateRole_isIdempotent_noDuplicates() throws Exception {
        User user = fan("idempotente@example.com");

        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post("/api/users/me/roles/host").header("Authorization", bearer(user)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.roles", contains("FAN", "HOST")));
        }

        assertThat(roles.findAll()).filteredOn(r -> r.getId().getUserId().equals(user.getId())).hasSize(2);
    }

    @Test
    void musician_doesNotBecomeHost() throws Exception {
        User user = fan("solomusicista@example.com");

        mockMvc.perform(post("/api/users/me/roles/musician").header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles", contains("FAN", "MUSICIAN")));

        // Uno non implica l'altro (sezione 5.3).
        assertThat(roles.findRolesByUserId(user.getId())).doesNotContain(Role.HOST);
    }

    @Test
    void activateRole_takesEffectWithTheSameToken() throws Exception {
        User user = fan("subito@example.com");
        String token = bearer(user);

        mockMvc.perform(post("/api/users/me/roles/host").header("Authorization", token))
                .andExpect(status().isOk());

        // Stesso token: il ruolo si legge dal database, non dal JWT (sezione 5.2).
        mockMvc.perform(get("/api/users/me").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles", contains("FAN", "HOST")));
    }

    @Test
    void activateRole_doesNotTouchPlatformRoles() throws Exception {
        User user = fan("admin@example.com");
        roles.save(new UserRole(user.getId(), Role.ADMIN));

        mockMvc.perform(post("/api/users/me/roles/musician").header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles", contains("FAN", "MUSICIAN", "ADMIN")));
    }

    @Test
    void activateRole_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/users/me/roles/musician"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mockMvc.perform(post("/api/users/me/roles/host"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void activateRole_withBody_isStillAccepted() throws Exception {
        User user = fan("body@example.com");

        // Gli endpoint non hanno body: un body inviato per errore non deve rompere la richiesta.
        mockMvc.perform(post("/api/users/me/roles/musician").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\": \"ADMIN\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles", contains("FAN", "MUSICIAN")));
    }

    // ---- supporto ----

    private User fan(String email) {
        User user = new User(email, "hash-di-prova", "Utente");
        user.setEmailVerified(true);
        users.save(user);
        roles.save(new UserRole(user.getId(), Role.FAN));
        return user;
    }

    private String bearer(User user) {
        return "Bearer " + accessTokens.issue(user.getId()).token();
    }
}

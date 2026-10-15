package it.epicode.resonance.user;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Profilo dell'utente autenticato e profilo pubblico (progettazione, sezioni 6.1 e 6.5): lettura di
 * {@code GET /api/users/me} e {@code GET /api/users/{id}}, modifica parziale con {@code PATCH} e rimozione
 * della posizione. Database reale, ruoli e stato sempre letti dal database.
 */
class ProfileIntegrationTest extends IntegrationTest {

    @Autowired
    private AccessTokenService accessTokens;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    // ---- GET /api/users/me ----

    @Test
    void me_returnsOwnProfileWithIdAndRoles() throws Exception {
        User user = verifiedUser("mario@example.com", "Mario", Role.FAN, Role.MUSICIAN);
        user.setBio("Chitarrista");
        user.setCity("Firenze");
        user.setLatitude(43.77);
        user.setLongitude(11.25);
        users.save(user);

        mockMvc.perform(get("/api/users/me").header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(user.getId().toString()))
                .andExpect(jsonPath("$.email").value("mario@example.com"))
                .andExpect(jsonPath("$.displayName").value("Mario"))
                .andExpect(jsonPath("$.bio").value("Chitarrista"))
                .andExpect(jsonPath("$.city").value("Firenze"))
                .andExpect(jsonPath("$.latitude").value(43.77))
                .andExpect(jsonPath("$.longitude").value(11.25))
                .andExpect(jsonPath("$.roles[0]").value("FAN"))
                .andExpect(jsonPath("$.roles[1]").value("MUSICIAN"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$", not(hasKey("passwordHash"))));
    }

    @Test
    void me_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    // ---- GET /api/users/{id} ----

    @Test
    void publicProfile_isVisibleWithoutToken_andHidesPrivateData() throws Exception {
        User user = verifiedUser("luisa@example.com", "Luisa", Role.FAN, Role.HOST);
        user.setAvatarUrl("https://example.com/luisa.png");
        user.setBio("Gestisco un locale");
        user.setCity("Roma");
        user.setLatitude(41.9);
        user.setLongitude(12.5);
        users.save(user);

        mockMvc.perform(get("/api/users/" + user.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(user.getId().toString()))
                .andExpect(jsonPath("$.displayName").value("Luisa"))
                .andExpect(jsonPath("$.avatarUrl").value("https://example.com/luisa.png"))
                .andExpect(jsonPath("$.bio").value("Gestisco un locale"))
                .andExpect(jsonPath("$.city").value("Roma"))
                .andExpect(jsonPath("$.roles", containsInAnyOrder("FAN", "HOST")))
                // Niente email, coordinate o dati di stato nel profilo pubblico (sezione 6.5).
                .andExpect(jsonPath("$", not(hasKey("email"))))
                .andExpect(jsonPath("$", not(hasKey("latitude"))))
                .andExpect(jsonPath("$", not(hasKey("longitude"))))
                .andExpect(jsonPath("$", not(hasKey("status"))));
    }

    @Test
    void publicProfile_showsOnlyCommunityRoles() throws Exception {
        User user = verifiedUser("admin@example.com", "Admin", Role.FAN, Role.ADMIN);

        mockMvc.perform(get("/api/users/" + user.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles", containsInAnyOrder("FAN")));
    }

    @Test
    void publicProfile_ofUnverifiedUser_returns404() throws Exception {
        User user = users.save(new User("nonverificato@example.com", "hash-di-prova", "Non verificato"));

        mockMvc.perform(get("/api/users/" + user.getId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void publicProfile_ofUnknownUser_returns404() throws Exception {
        mockMvc.perform(get("/api/users/" + UUID.randomUUID()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void publicProfile_withInvalidId_returns400() throws Exception {
        mockMvc.perform(get("/api/users/non-un-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void publicProfile_withInvalidToken_stillWorks() throws Exception {
        User user = verifiedUser("pubblico@example.com", "Pubblico", Role.FAN);

        // Un token rimasto nel frontend non deve bloccare una pagina pubblica (sezione 8.2).
        mockMvc.perform(get("/api/users/" + user.getId()).header("Authorization", "Bearer spazzatura"))
                .andExpect(status().isOk());
    }

    // ---- PATCH /api/users/me ----

    @Test
    void patch_changesOnlyTheSentField() throws Exception {
        User user = profiledUser("patch@example.com");

        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"city\": \"Milano\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.city").value("Milano"))
                .andExpect(jsonPath("$.displayName").value("Nome Iniziale"))
                .andExpect(jsonPath("$.bio").value("Bio iniziale"))
                .andExpect(jsonPath("$.avatarUrl").value("https://example.com/a.png"))
                .andExpect(jsonPath("$.latitude").value(43.77));

        User reloaded = users.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getCity()).isEqualTo("Milano");
        assertThat(reloaded.getDisplayName()).isEqualTo("Nome Iniziale");
        assertThat(reloaded.getBio()).isEqualTo("Bio iniziale");
    }

    @Test
    void patch_emptyString_clearsOptionalFields() throws Exception {
        User user = profiledUser("svuota@example.com");

        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bio\": \"\", \"city\": \"   \", \"avatarUrl\": \"\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bio").value(nullValue()))
                .andExpect(jsonPath("$.city").value(nullValue()))
                .andExpect(jsonPath("$.avatarUrl").value(nullValue()));

        // Salvati come NULL e non come stringa vuota (sezione 6.1).
        User reloaded = users.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getBio()).isNull();
        assertThat(reloaded.getCity()).isNull();
        assertThat(reloaded.getAvatarUrl()).isNull();
        assertThat(reloaded.getDisplayName()).isEqualTo("Nome Iniziale");
    }

    @Test
    void patch_nullField_leavesItUnchanged() throws Exception {
        User user = profiledUser("null@example.com");

        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bio\": null, \"displayName\": null, \"latitude\": null, \"longitude\": null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bio").value("Bio iniziale"))
                .andExpect(jsonPath("$.displayName").value("Nome Iniziale"))
                .andExpect(jsonPath("$.latitude").value(43.77))
                .andExpect(jsonPath("$.longitude").value(11.25));
    }

    @Test
    void patch_emptyBody_returns200WithoutChanges() throws Exception {
        User user = profiledUser("vuoto@example.com");

        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Nome Iniziale"))
                .andExpect(jsonPath("$.bio").value("Bio iniziale"))
                .andExpect(jsonPath("$.city").value("Firenze"));
    }

    @Test
    void patch_trimsTextFields() throws Exception {
        User user = profiledUser("trim@example.com");

        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\": \"  Nuovo Nome  \", \"bio\": \"  testo  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Nuovo Nome"))
                .andExpect(jsonPath("$.bio").value("testo"));
    }

    @Test
    void patch_emptyDisplayName_returns400() throws Exception {
        User user = profiledUser("nome@example.com");

        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\": \"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.displayName").exists());
        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\": \"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.displayName").exists());

        assertThat(users.findById(user.getId()).orElseThrow().getDisplayName()).isEqualTo("Nome Iniziale");
    }

    @Test
    void patch_displayNameOutsideLengthRange_returns400() throws Exception {
        User user = profiledUser("lunghezza@example.com");

        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\": \"A\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.displayName").exists());
        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\": \"" + "x".repeat(51) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.displayName").exists());
    }

    @Test
    void patch_textFieldsOverMaxLength_return400() throws Exception {
        User user = profiledUser("max@example.com");

        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bio\": \"" + "b".repeat(501) + "\", \"city\": \"" + "c".repeat(101) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.bio").exists())
                .andExpect(jsonPath("$.fields.city").exists());
    }

    @Test
    void patch_avatarUrlMustBeHttpOrHttps() throws Exception {
        User user = profiledUser("avatar@example.com");

        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"avatarUrl\": \"javascript:alert(1)\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.avatarUrl").exists());
        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"avatarUrl\": \"https://example.com/nuovo.png\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value("https://example.com/nuovo.png"));
    }

    @Test
    void patch_bothCoordinates_areSaved() throws Exception {
        User user = verifiedUser("coordinate@example.com", "Coordinate", Role.FAN);

        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitude\": 45.46, \"longitude\": 9.19}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latitude").value(45.46))
                .andExpect(jsonPath("$.longitude").value(9.19));

        User reloaded = users.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getLatitude()).isEqualTo(45.46);
        assertThat(reloaded.getLongitude()).isEqualTo(9.19);
    }

    @Test
    void patch_onlyLatitude_returns400() throws Exception {
        User user = profiledUser("soloLat@example.com");

        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitude\": 45.0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.latitude").exists());
    }

    @Test
    void patch_onlyLongitude_returns400() throws Exception {
        User user = profiledUser("soloLng@example.com");

        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"longitude\": 9.0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.longitude").exists());
        // Una coordinata presente e l'altra null equivale a una sola coordinata.
        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"longitude\": 9.0, \"latitude\": null}"))
                .andExpect(status().isBadRequest());

        User reloaded = users.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getLatitude()).isEqualTo(43.77);
        assertThat(reloaded.getLongitude()).isEqualTo(11.25);
    }

    @Test
    void patch_coordinatesOutOfRange_return400() throws Exception {
        User user = profiledUser("range@example.com");

        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitude\": 91, \"longitude\": 10}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.latitude").exists());
        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitude\": 10, \"longitude\": -181}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.longitude").exists());
    }

    @Test
    void patch_withoutToken_returns401() throws Exception {
        mockMvc.perform(patch("/api/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"city\": \"Milano\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void patch_cannotChangeEmailOrStatus() throws Exception {
        User user = profiledUser("immutabile@example.com");

        // Campi sconosciuti sono ignorati: PATCH non puo' toccare email, stato o ruoli.
        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"altra@example.com\", \"status\": \"SUSPENDED\", \"roles\": [\"ADMIN\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("immutabile@example.com"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.roles", containsInAnyOrder("FAN")));
    }

    // ---- DELETE /api/users/me/location ----

    @Test
    void deleteLocation_clearsCoordinates_andIsIdempotent() throws Exception {
        User user = profiledUser("posizione@example.com");

        mockMvc.perform(delete("/api/users/me/location").header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latitude").value(nullValue()))
                .andExpect(jsonPath("$.longitude").value(nullValue()))
                // Il resto del profilo non cambia.
                .andExpect(jsonPath("$.city").value("Firenze"));
        mockMvc.perform(delete("/api/users/me/location").header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latitude").value(nullValue()));

        User reloaded = users.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getLatitude()).isNull();
        assertThat(reloaded.getLongitude()).isNull();
    }

    @Test
    void deleteLocation_withoutToken_returns401() throws Exception {
        mockMvc.perform(delete("/api/users/me/location"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    // ---- supporto ----

    /** Utente FAN con tutti i campi del profilo valorizzati. */
    private User profiledUser(String email) {
        User user = verifiedUser(email, "Nome Iniziale", Role.FAN);
        user.setBio("Bio iniziale");
        user.setCity("Firenze");
        user.setAvatarUrl("https://example.com/a.png");
        user.setLatitude(43.77);
        user.setLongitude(11.25);
        return users.save(user);
    }

    private User verifiedUser(String email, String displayName, Role... userRoles) {
        User user = new User(email, "hash-di-prova", displayName);
        user.setEmailVerified(true);
        users.save(user);
        for (Role role : userRoles) {
            roles.save(new UserRole(user.getId(), role));
        }
        return user;
    }

    private String bearer(User user) {
        return "Bearer " + accessTokens.issue(user.getId()).token();
    }
}

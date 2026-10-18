package it.epicode.resonance.config;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tetto di 256 KB sul body JSON (progettazione, sezione 8.6; decisione 76, S5): un body piu' grande viene respinto
 * mentre si legge, con il 400 VALIDATION_ERROR di sempre; il body legittimo piu' grande dell'API passa.
 */
class JsonBodyLimitIntegrationTest extends IntegrationTest {

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private AccessTokenService accessTokens;

    @Test
    void login_withBodyJustOver256Kb_returns400NotReadable() throws Exception {
        // Campi validi e un campo in piu' che il DTO ignora: senza il tetto la richiesta arriverebbe fino al 401.
        String body = "{\"email\":\"mario@example.com\",\"password\":\"password-qualsiasi\",\"padding\":\""
                + "a".repeat(256 * 1024 + 1) + "\"}";

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Corpo della richiesta non leggibile"));
    }

    @Test
    void login_withBodyJustUnder256Kb_isReadAndFailsOnlyOnTheCredentials() throws Exception {
        String body = "{\"email\":\"mario@example.com\",\"password\":\"password-qualsiasi\",\"padding\":\""
                + "a".repeat(255 * 1024) + "\"}";

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void collabPost_withTheLargestLegitimateDescription_isAccepted() throws Exception {
        // 5000 caratteri da 2 byte: circa 10 KB (con le emoji il limite di 5000 caratteri darebbe 400), sotto il tetto.
        User musician = new User("musicista@example.com", "hash-di-prova", "Musicista");
        musician.setEmailVerified(true);
        users.save(musician);
        roles.save(new UserRole(musician.getId(), Role.MUSICIAN));
        String body = "{\"title\":\"Cerco chitarrista\",\"description\":\"" + "è".repeat(5000)
                + "\",\"roleNeeded\":\"Chitarra\"}";

        mockMvc.perform(post("/api/collab-posts")
                        .header("Authorization", "Bearer " + accessTokens.issue(musician.getId()).token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());
    }
}

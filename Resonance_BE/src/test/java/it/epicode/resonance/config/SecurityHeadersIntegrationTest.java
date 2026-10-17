package it.epicode.resonance.config;

import it.epicode.resonance.support.IntegrationTest;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Header di sicurezza delle risposte (progettazione, sezione 8.1): quelli predefiniti di Spring Security
 * restano attivi e Referrer-Policy e Permissions-Policy sono aggiunti a mano, su risposte di successo e di errore.
 */
class SecurityHeadersIntegrationTest extends IntegrationTest {

    @Test
    void publicResponse_hasTheDefaultSecurityHeaders() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Cache-Control", containsString("no-store")));
    }

    @Test
    void publicResponse_hasReferrerAndPermissionsPolicy() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().string("Permissions-Policy", containsString("geolocation=(self)")));
    }

    @Test
    void errorResponses_haveTheSameHeaders() throws Exception {
        // 401 prodotto dall'AuthenticationEntryPoint e 404 di un percorso /api inesistente.
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"));
        mockMvc.perform(get("/api/inesistente"))
                .andExpect(status().isNotFound())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"));
    }

    @Test
    void secureRequest_getsStrictTransportSecurity() throws Exception {
        // Dietro il proxy di Render la richiesta risulta https (forward-headers-strategy: native).
        mockMvc.perform(get("/api/health").secure(true))
                .andExpect(header().string("Strict-Transport-Security", containsString("max-age=")));
    }
}

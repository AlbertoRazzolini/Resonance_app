package it.epicode.resonance.config;

import it.epicode.resonance.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CORS con l'origine del dev server Vite, come nel profilo "dev" (progettazione, sezione 6.12): solo
 * quella origine, con credenziali, i metodi e gli header previsti. L'origine e' impostata qui perche'
 * il profilo "test" non la ha.
 */
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:5173")
class CorsDevIntegrationTest extends IntegrationTest {

    @Test
    void preflightFromViteOrigin_isAllowedWithCredentials() throws Exception {
        mockMvc.perform(options("/api/health")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "PATCH")
                        .header("Access-Control-Request-Headers", "authorization,x-requested-with"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"))
                .andExpect(header().string("Access-Control-Max-Age", "3600"));
    }

    @Test
    void preflightFromOtherOrigin_isRejected() throws Exception {
        mockMvc.perform(options("/api/health")
                        .header("Origin", "http://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void preflightWithHeaderNotInTheList_isRejected() throws Exception {
        mockMvc.perform(options("/api/health")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "x-custom-secret"))
                .andExpect(status().isForbidden());
    }
}

package it.epicode.resonance.config;

import it.epicode.resonance.support.IntegrationTest;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Content-Security-Policy sugli script (decisione 76): l'header e' presente con il valore esatto sulla pagina del
 * frontend, sulle API (anche negli errori) e sulla Swagger UI.
 */
class CspIntegrationTest extends IntegrationTest {

    private static final String CSP = "script-src 'self'; object-src 'none'; base-uri 'self'; "
            + "frame-ancestors 'none'; form-action 'self'";

    @Test
    void frontendPage_hasTheContentSecurityPolicy() throws Exception {
        mockMvc.perform(get("/index.html"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Security-Policy", CSP));
    }

    @Test
    void apiResponse_hasTheContentSecurityPolicy() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Security-Policy", CSP));
    }

    @Test
    void swaggerUi_hasTheContentSecurityPolicy() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Security-Policy", CSP));
    }

    @Test
    void errorResponse_hasTheContentSecurityPolicy() throws Exception {
        // 401 prodotto dall'AuthenticationEntryPoint: l'header deve esserci anche sugli errori.
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Content-Security-Policy", CSP));
    }
}

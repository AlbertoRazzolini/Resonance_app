package it.epicode.resonance.config;

import it.epicode.resonance.support.IntegrationTest;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CORS con ALLOWED_ORIGIN vuota, come in produzione: nessuna origine esterna e' ammessa
 * (progettazione, sezione 6.12). Il profilo "test" ha la stessa configurazione vuota di "prod".
 */
class CorsProdIntegrationTest extends IntegrationTest {

    @Test
    void preflightFromAnyExternalOrigin_isRejected() throws Exception {
        mockMvc.perform(options("/api/health")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "authorization,x-requested-with"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void sameOriginRequest_isNotBlocked() throws Exception {
        // Origin uguale all'host della richiesta: non e' cross-origin e passa (sezione 6.12).
        mockMvc.perform(get("/api/health").header("Origin", "http://localhost"))
                .andExpect(status().isOk());
    }
}

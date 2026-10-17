package it.epicode.resonance.config;

import it.epicode.resonance.support.IntegrationTest;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Documentazione OpenAPI (decisione 5): la descrizione delle API e la Swagger UI sono pubbliche, lo schema
 * Bearer e' dichiarato e l'apertura dei percorsi di documentazione non apre nient'altro.
 */
class OpenApiIntegrationTest extends IntegrationTest {

    @Test
    void apiDocs_arePublicAndDescribeTheBearerScheme() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openapi").exists())
                .andExpect(jsonPath("$.info.title").value("Resonance API"))
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.scheme").value("bearer"))
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.bearerFormat").value("JWT"));
    }

    @Test
    void apiDocs_listTheApplicationEndpoints() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/health']").exists())
                .andExpect(jsonPath("$.paths['/api/auth/login']").exists());
    }

    @Test
    void swaggerUi_isPublic() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("swagger-ui")));
    }

    @Test
    void docsPaths_doNotOpenOtherPostRequests() throws Exception {
        // Solo i GET della documentazione sono pubblici: un POST su quei percorsi resta protetto.
        mockMvc.perform(post("/v3/api-docs"))
                .andExpect(status().isUnauthorized());
    }
}

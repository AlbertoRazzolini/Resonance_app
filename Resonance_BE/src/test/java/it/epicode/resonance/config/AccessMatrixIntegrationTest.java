package it.epicode.resonance.config;

import it.epicode.resonance.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Matrice di accesso (progettazione, sezioni 6.3 e 8.4): elenca tutti gli endpoint /api/** realmente mappati
 * e verifica che solo quelli dell'elenco pubblico rispondano senza token; ogni altro risponde 401. Un endpoint
 * nuovo, dimenticato nell'elenco, fa fallire il test invece di restare esposto o bloccato per errore.
 */
class AccessMatrixIntegrationTest extends IntegrationTest {

    /** Elenco pubblico atteso, per metodo e percorso, come nella sezione 6.3 del design. */
    private static final Set<String> PUBLIC_ENDPOINTS = Set.of(
            "GET /api/health",
            "POST /api/auth/register",
            "POST /api/auth/verify",
            "POST /api/auth/resend-code",
            "POST /api/auth/login",
            "POST /api/auth/refresh",
            "DELETE /api/auth/refresh",
            "POST /api/auth/password/forgot",
            "POST /api/auth/password/reset",
            "GET /api/users/{id}",
            "GET /api/official-concerts/nearby",
            "GET /api/official-concerts/{id}",
            "GET /api/indie-events/nearby",
            "GET /api/indie-events/{id}",
            "GET /api/collab-posts",
            "GET /api/collab-posts/{id}",
            "GET /api/feed-posts",
            "GET /api/feed-posts/{id}");

    @Autowired
    private RequestMappingHandlerMapping handlerMapping;

    @Test
    void everyMappedApiEndpoint_isPublicOnlyIfListed_andOtherwiseReturns401WithoutToken() throws Exception {
        Set<String> seen = new TreeSet<>();
        Set<String> unexpectedlyOpen = new TreeSet<>();
        Set<String> unexpectedlyClosed = new TreeSet<>();

        for (RequestMappingInfo info : handlerMapping.getHandlerMethods().keySet()) {
            if (info.getPathPatternsCondition() == null) {
                continue;
            }
            for (var pattern : info.getPathPatternsCondition().getPatterns()) {
                String path = pattern.getPatternString();
                if (!path.startsWith("/api/")) {
                    continue;
                }
                for (RequestMethod method : info.getMethodsCondition().getMethods()) {
                    String key = method + " " + path;
                    seen.add(key);
                    MvcResult result = mockMvc.perform(request(HttpMethod.valueOf(method.name()),
                            path.replaceAll("\\{[^}]+}", UUID.randomUUID().toString()))).andReturn();
                    int status = result.getResponse().getStatus();
                    boolean listedAsPublic = PUBLIC_ENDPOINTS.contains(key);
                    if (!listedAsPublic && status != 401) {
                        unexpectedlyOpen.add(key + " -> " + status);
                    }
                    // Il refresh senza cookie risponde 401 per un motivo suo (cookie mancante), non per il Bearer.
                    if (listedAsPublic && status == 401 && !path.equals("/api/auth/refresh")) {
                        unexpectedlyClosed.add(key);
                    }
                }
            }
        }

        assertThat(unexpectedlyOpen).as("endpoint non pubblici che rispondono senza token").isEmpty();
        assertThat(unexpectedlyClosed).as("endpoint pubblici che chiedono il token").isEmpty();
        assertThat(seen).as("l'elenco pubblico atteso contiene solo endpoint esistenti").containsAll(PUBLIC_ENDPOINTS);
    }
}

package it.epicode.resonance.web;

import it.epicode.resonance.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Fallback SPA (progettazione, sezioni 6.3 e 12.5): le rotte del frontend rispondono con index.html, i file
 * statici con il proprio contenuto, e i percorsi dell'API e del WebSocket non vengono mai confusi con una
 * rotta. Usa l'index.html e l'assets/app.js di prova in src/test/resources/static, senza token.
 */
class SpaFallbackTest extends IntegrationTest {

    @Test
    void frontendRoute_returnsIndexHtmlWithoutCache() throws Exception {
        mockMvc.perform(get("/eventi/123"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("index di prova")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-cache")));
    }

    @Test
    void root_forwardsToIndexHtml() throws Exception {
        // La pagina iniziale la gestisce il welcome page di Spring Boot con un forward a index.html (MockMvc
        // non lo segue); il file vero lo serve il test successivo.
        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("index.html"));
    }

    @Test
    void indexHtml_isServedDirectlyWithoutCache() throws Exception {
        mockMvc.perform(get("/index.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("index di prova")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-cache")));
    }

    @Test
    void staticAsset_isServedWithLongCache() throws Exception {
        mockMvc.perform(get("/assets/app.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("file statico di prova")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("max-age=31536000")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("immutable")));
    }

    @Test
    void missingFileWithExtension_returns404Json() throws Exception {
        // Un file con estensione che non esiste e' un errore vero, non una rotta: niente index.html.
        mockMvc.perform(get("/assets/mancante.js"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void unknownApiPath_returns404JsonNotIndexHtml() throws Exception {
        mockMvc.perform(get("/api/inesistente"))
                .andExpect(status().isNotFound())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, startsWith("application/json")))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void unknownNestedApiPath_returns404JsonNotIndexHtml() throws Exception {
        mockMvc.perform(get("/api/eventi/123"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void protectedApiPath_stillRequiresToken() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void postOutsideApi_requiresToken() throws Exception {
        // Solo i GET statici sono pubblici (sezione 6.3): ogni altro metodo resta protetto.
        mockMvc.perform(post("/qualcosa"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void headOnFrontendRouteAndStaticFiles_isPublic() throws Exception {
        // Controlli di uptime e anteprime dei link usano HEAD (decisione 74, aggiornata in FE-11).
        mockMvc.perform(head("/eventi/123")).andExpect(status().isOk());
        mockMvc.perform(head("/index.html")).andExpect(status().isOk());
        mockMvc.perform(head("/assets/app.js")).andExpect(status().isOk());
    }

    @Test
    void headOnApi_requiresTokenEvenWhenGetIsPublic() throws Exception {
        // HEAD si apre solo fuori da /api e /ws: su /api/health, pubblico in GET, resta protetto.
        mockMvc.perform(head("/api/health"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mockMvc.perform(head("/api/users/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void wsPath_isNotServedAsFrontendRoute() throws Exception {
        // /ws appartiene al WebSocket: una GET semplice non deve ricevere index.html.
        mockMvc.perform(get("/ws/qualcosa"))
                .andExpect(result -> {
                    String body = result.getResponse().getContentAsString();
                    if (body.contains("index di prova")) {
                        throw new AssertionError("/ws ha restituito index.html");
                    }
                });
    }
}

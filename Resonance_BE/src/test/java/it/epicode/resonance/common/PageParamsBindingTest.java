package it.epicode.resonance.common;

import it.epicode.resonance.support.MutableClock;
import jakarta.validation.Valid;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * PageParams letto dai parametri di una vera richiesta: default quando mancano, 400 con il campo
 * sbagliato quando sono fuori range (progettazione, sezione 6.1).
 */
class PageParamsBindingTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new TestController())
                .setControllerAdvice(new GlobalExceptionHandler(new MutableClock(Instant.now())))
                .build();
    }

    @Test
    void withoutParameters_usesDefaults() throws Exception {
        mockMvc.perform(get("/test/page"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20));
    }

    @Test
    void validParameters_areUsed() throws Exception {
        mockMvc.perform(get("/test/page").param("page", "3").param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(3))
                .andExpect(jsonPath("$.size").value(50));
    }

    @Test
    void pagination_rejectsOutOfRange() throws Exception {
        mockMvc.perform(get("/test/page").param("page", "-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.page").exists());
        mockMvc.perform(get("/test/page").param("size", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.size").exists());
        mockMvc.perform(get("/test/page").param("size", "1000"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.size").exists());
    }

    @Test
    void nonNumericValue_isRejected() throws Exception {
        mockMvc.perform(get("/test/page").param("page", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    /**
     * Controller di prova, escluso dalla scansione perche' annidato in una classe di test.
     */
    @RestController
    @RequestMapping("/test")
    static class TestController {

        @GetMapping("/page")
        Map<String, Integer> page(@Valid PageParams params) {
            return Map.of("page", params.page(), "size", params.size());
        }
    }
}

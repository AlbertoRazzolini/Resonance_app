package it.epicode.resonance.common;

import it.epicode.resonance.support.MutableClock;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Valid;
import jakarta.validation.Validation;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Traduzione di ogni tipo di eccezione in un ErrorResponse con status e codice stabili e senza
 * dettagli interni (progettazione, sezioni 6.1 e 6.2). Usa MockMvc "standalone": niente contesto
 * Spring e niente sicurezza, solo controller di prova e handler.
 */
class GlobalExceptionHandlerTest {

    private static final Instant NOW = Instant.parse("2026-10-14T10:00:00Z");

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler(new MutableClock(NOW));
        mockMvc = MockMvcBuilders.standaloneSetup(new TestController())
                .setControllerAdvice(handler)
                .build();
    }

    @Test
    void appException_returnsItsStatusCodeAndTimestamp() throws Exception {
        mockMvc.perform(get("/test/app-exception"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("Evento non trovato"))
                .andExpect(jsonPath("$.timestamp").value("2026-10-14T10:00:00Z"));
    }

    @Test
    void appException_carriesFieldsAndDetails() throws Exception {
        mockMvc.perform(get("/test/app-exception-details"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"))
                .andExpect(jsonPath("$.fields.address").value("non trovato"))
                .andExpect(jsonPath("$.details.reason").value("prova"));
    }

    @Test
    void response_alwaysHasFieldsAndDetailsAsObjects() throws Exception {
        // Il frontend puo' leggere fields e details senza controllare se esistono.
        mockMvc.perform(get("/test/app-exception"))
                .andExpect(jsonPath("$.fields").isMap())
                .andExpect(jsonPath("$.details").isMap());
    }

    @Test
    void invalidBody_returns400WithFields() throws Exception {
        mockMvc.perform(post("/test/validate").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.name").exists());
    }

    @Test
    void unreadableBody_returns400() throws Exception {
        mockMvc.perform(post("/test/validate").contentType(MediaType.APPLICATION_JSON).content("{non e' json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void parameterOfWrongType_returns400() throws Exception {
        mockMvc.perform(get("/test/number").param("n", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value(containsString("'n'")));
    }

    @Test
    void missingRequiredParameter_returns400() throws Exception {
        mockMvc.perform(get("/test/number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void constraintViolation_returns400WithFields() throws Exception {
        mockMvc.perform(get("/test/constraint-violation"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.name").exists());
    }

    @Test
    void missingResource_returns404Json() throws Exception {
        mockMvc.perform(get("/test/no-resource"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void unsupportedMethod_returns405() throws Exception {
        mockMvc.perform(get("/test/post-only"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    void unexpectedException_returns500WithoutInternalDetails() throws Exception {
        // Mai stack trace o messaggi interni nel corpo (progettazione, sezione 6.1).
        mockMvc.perform(get("/test/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(content().string(not(containsString("segreto-interno"))))
                .andExpect(content().string(not(containsString("it.epicode"))))
                .andExpect(content().string(not(containsString("stackTrace"))));
    }

    @Test
    void dataIntegrityViolation_returnsGenericConflict() {
        var response = new GlobalExceptionHandler(new MutableClock(NOW))
                .handle(new DataIntegrityViolationException("vincolo"));

        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(response.getBody().code()).isEqualTo("CONFLICT");
    }

    /**
     * Controller di prova. Essendo annidato in una classe di test, Spring Boot lo esclude dalla
     * scansione dei componenti degli altri test.
     */
    @RestController
    @RequestMapping("/test")
    static class TestController {

        record Body(@NotBlank String name) {
        }

        @GetMapping("/app-exception")
        String appException() {
            throw new AppException(ErrorCode.NOT_FOUND, "Evento non trovato");
        }

        @GetMapping("/app-exception-details")
        String appExceptionDetails() {
            throw new AppException(ErrorCode.CONFLICT, "Conflitto", Map.of("address", "non trovato"))
                    .withDetails(Map.of("reason", "prova"));
        }

        @PostMapping("/validate")
        String validate(@Valid @RequestBody Body body) {
            return body.name();
        }

        @GetMapping("/number")
        int number(@RequestParam int n) {
            return n;
        }

        @GetMapping("/constraint-violation")
        String constraintViolation() {
            var validator = Validation.buildDefaultValidatorFactory().getValidator();
            throw new ConstraintViolationException(validator.validate(new Body("")));
        }

        @GetMapping("/no-resource")
        String noResource() throws NoResourceFoundException {
            throw new NoResourceFoundException(HttpMethod.GET, "/test/no-resource", "test/no-resource");
        }

        @PostMapping("/post-only")
        String postOnly() {
            return "ok";
        }

        @GetMapping("/boom")
        String boom() {
            throw new IllegalStateException("segreto-interno");
        }
    }
}

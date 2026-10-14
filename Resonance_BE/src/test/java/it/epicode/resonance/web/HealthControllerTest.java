package it.epicode.resonance.web;

import it.epicode.resonance.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class HealthControllerTest extends IntegrationTest {

    @Test
    void health_returnsUpWhenDatabaseResponds() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.database").value("UP"));
    }

    @Test
    void health_returns503WhenDatabaseFails() throws Exception {
        JdbcTemplate failingJdbc = new JdbcTemplate() {
            @Override
            public <T> T queryForObject(String sql, Class<T> requiredType) {
                throw new DataAccessResourceFailureException("database spento");
            }
        };

        MockMvcBuilders.standaloneSetup(new HealthController(failingJdbc)).build()
                .perform(get("/api/health"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("DOWN"))
                .andExpect(jsonPath("$.database").value("DOWN"));
    }

    @Test
    void otherEndpoints_areNotPublic() throws Exception {
        // SecurityConfig temporaneo di F0-02: solo /api/health e' permesso (sostituito in F1-01).
        mockMvc.perform(get("/api/qualcosa"))
                .andExpect(status().isForbidden());
    }
}

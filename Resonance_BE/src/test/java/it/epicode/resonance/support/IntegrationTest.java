package it.epicode.resonance.support;

import jakarta.servlet.Filter;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.Instant;
import java.util.List;

/**
 * Base dei test di integrazione: contesto completo con profilo "test" (database resonance_test,
 * progettazione, sezione 11.1), MockMvc con la vera catena di filtri di Spring Security e database
 * svuotato prima di ogni test. Richiede il container Docker acceso (docker compose up -d).
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestClockConfig.class)
public abstract class IntegrationTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    protected MutableClock clock;

    protected MockMvc mockMvc;

    @BeforeEach
    void resetState() {
        // Tutte le tabelle applicative, tranne lo storico di Flyway.
        List<String> tables = jdbc.queryForList(
                "select tablename from pg_tables where schemaname = 'public' and tablename <> 'flyway_schema_history'",
                String.class);
        if (!tables.isEmpty()) {
            jdbc.execute("TRUNCATE TABLE " + String.join(", ", tables) + " CASCADE");
        }
        clock.setInstant(Instant.now());

        // MockMvc gira nel thread del test; la catena di Spring Security si aggiunge come filtro.
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(context.getBean("springSecurityFilterChain", Filter.class))
                .build();
    }
}

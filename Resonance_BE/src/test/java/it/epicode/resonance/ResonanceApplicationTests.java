package it.epicode.resonance;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Il contesto Spring parte con il database di test e lo schema coincide con le entity
 * (ddl-auto: validate, progettazione, sezione 3.7).
 */
@SpringBootTest
@ActiveProfiles("test")
class ResonanceApplicationTests {

    @Test
    void contextLoads() {
    }

}

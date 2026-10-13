package it.epicode.resonance;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@Disabled("abilitato in F0-02 con il database")
@SpringBootTest
@ActiveProfiles("test")
class ResonanceApplicationTests {

    @Test
    void contextLoads() {
    }

}

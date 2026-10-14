package it.epicode.resonance;

import it.epicode.resonance.config.DatabaseUrl;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Punto di avvio dell'applicazione Spring Boot.
 */
@SpringBootApplication
public class ResonanceApplication {

    /**
     * Prepara il datasource da DATABASE_URL e poi avvia Spring.
     */
    public static void main(String[] args) {
        // Prima di Spring: converte DATABASE_URL di Render in proprieta' JDBC (progettazione, sezione 12.3).
        DatabaseUrl.applyIfPresent();
        SpringApplication.run(ResonanceApplication.class, args);
    }

}

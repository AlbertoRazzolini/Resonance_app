package it.epicode.resonance;

import it.epicode.resonance.config.DatabaseUrl;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ResonanceApplication {

    public static void main(String[] args) {
        // Prima di Spring: converte DATABASE_URL di Render in proprieta' JDBC (progettazione, sezione 12.3).
        DatabaseUrl.applyIfPresent();
        SpringApplication.run(ResonanceApplication.class, args);
    }

}

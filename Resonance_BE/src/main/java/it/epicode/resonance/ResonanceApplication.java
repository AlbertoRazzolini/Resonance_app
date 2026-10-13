package it.epicode.resonance;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ResonanceApplication {

    public static void main(String[] args) {
        // DatabaseUrl.applyIfPresent() va chiamato qui, prima di Spring (progettazione, sezione 12.3): arriva in F0-02.
        SpringApplication.run(ResonanceApplication.class, args);
    }

}

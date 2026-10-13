package it.epicode.resonance.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * "Adesso" si calcola da questo Clock iniettato (progettazione, sezione 2.1),
 * cosi' nei test si puo' sostituire con uno controllabile.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}

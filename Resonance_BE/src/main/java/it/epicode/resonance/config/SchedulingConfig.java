package it.epicode.resonance.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Attiva i metodi @Scheduled (es. la pulizia dei refresh token scaduti).
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}

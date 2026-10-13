package it.epicode.resonance.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Attiva i metodi @Async (es. l'invio delle email dopo il commit, in EmailEventListener).
 */
@Configuration
@EnableAsync
public class AsyncConfig {
}

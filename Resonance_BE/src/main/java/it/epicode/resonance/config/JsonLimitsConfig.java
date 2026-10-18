package it.epicode.resonance.config;

import org.springframework.boot.jackson.autoconfigure.JsonFactoryBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.core.StreamReadConstraints;

/**
 * Tetto di 256 KB sul documento JSON letto da Jackson (progettazione, sezione 8.6; decisione 76, S5): il limite di
 * Tomcat vale per i form, non per il JSON, e pochi body da decine di MB esaurirebbero la memoria del piano gratuito.
 * Oltre il tetto la lettura si interrompe e la risposta e' il 400 VALIDATION_ERROR gia' esistente. Il body
 * legittimo piu' grande dell'API sta sotto i 40 KB.
 */
@Configuration
public class JsonLimitsConfig {

    static final long MAX_DOCUMENT_LENGTH = 256L * 1024;

    /**
     * Le costanti di lettura stanno sulla factory di Jackson 3: Spring Boot applica il customizer alla factory
     * del mapper che usa anche il convertitore di Spring MVC.
     */
    @Bean
    public JsonFactoryBuilderCustomizer jsonDocumentLengthLimit() {
        return builder -> builder.streamReadConstraints(
                StreamReadConstraints.builder().maxDocumentLength(MAX_DOCUMENT_LENGTH).build());
    }
}

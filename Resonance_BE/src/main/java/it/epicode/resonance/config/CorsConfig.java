package it.epicode.resonance.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS su /api/** (progettazione, sezione 6.12). In produzione frontend e API hanno la stessa origine
 * e ALLOWED_ORIGIN e' vuota: nessuna origine esterna e' ammessa. In sviluppo ammette il dev server Vite.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final String[] allowedOrigins;

    public CorsConfig(@Value("${app.cors.allowed-origins}") String[] allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    /**
     * Con le credenziali le origini devono essere esplicite (mai "*"); le richieste della stessa origine
     * non sono cross-origin e passano comunque.
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowCredentials(true)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("Authorization", "Content-Type", "X-Requested-With")
                .maxAge(3600);
    }
}

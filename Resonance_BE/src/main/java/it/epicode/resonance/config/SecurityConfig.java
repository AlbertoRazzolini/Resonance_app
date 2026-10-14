package it.epicode.resonance.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Configurazione TEMPORANEA di F0-02: stateless, solo GET /api/health e' pubblico e tutto il resto
 * e' negato. Viene sostituita in F1-01 da quella completa (progettazione, sezione 8.1).
 */
@Configuration
public class SecurityConfig {

    /**
     * Catena di filtri temporanea: senza sessioni, solo GET /api/health e' pubblico, il resto e' negato.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                        .anyRequest().denyAll());
        return http.build();
    }
}

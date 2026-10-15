package it.epicode.resonance.config;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.auth.JwtFilter;
import it.epicode.resonance.auth.UserAccessService;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.ErrorResponse;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.servlet.handler.HandlerMappingIntrospector;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Map;

/**
 * Catena di sicurezza dell'API (progettazione, sezioni 8.1-8.4): senza sessioni, con il JWT letto da
 * {@link JwtFilter} e gli endpoint pubblici elencati uno per uno. Ogni endpoint pubblico nuovo si
 * aggiunge qui, con la card che lo crea.
 */
@Configuration
public class SecurityConfig {

    private final JsonMapper jsonMapper;
    private final Clock clock;

    public SecurityConfig(JsonMapper jsonMapper, Clock clock) {
        this.jsonMapper = jsonMapper;
        this.clock = clock;
    }

    /**
     * Regole di accesso. L'ordine conta: la prima regola che corrisponde decide.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, AccessTokenService accessTokens,
                                                   UserAccessService userAccess,
                                                   HandlerMappingIntrospector introspector) {
        http
                // L'autenticazione sta nell'header Authorization, che il browser non invia da solo: niente
                // CSRF di Spring. Refresh e logout, basati su cookie, hanno la difesa dedicata della sezione 8.5.
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(requests -> requests
                        // Prima di tutto: un /api/... senza handler risponde 404 JSON, anche senza token
                        // e anche sotto /api/admin/** (sezione 6.3), non 401 ne' 403.
                        .requestMatchers(new UnmappedApiRequestMatcher(introspector)).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                        // Auth pubblica (sezione 6.3): refresh e logout si difendono con l'header custom
                        // e il controllo dell'Origin (sezione 8.5), non col Bearer.
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/verify",
                                "/api/auth/resend-code", "/api/auth/login", "/api/auth/refresh",
                                "/api/auth/password/forgot", "/api/auth/password/reset").permitAll()
                        .requestMatchers(HttpMethod.DELETE, "/api/auth/refresh").permitAll()
                        // Profilo pubblico (sezione 6.5). "me" prima, altrimenti {id} renderebbe pubblico
                        // anche il profilo proprio.
                        .requestMatchers(HttpMethod.GET, "/api/users/me").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/users/{id}").permitAll()
                        // Concerti ufficiali (sezione 6.6): lettura pubblica, creazione solo HOST. La
                        // cancellazione del proprietario richiede il login (anyRequest) e il controllo
                        // di proprieta' sta nel service.
                        .requestMatchers(HttpMethod.POST, "/api/official-concerts").hasRole("HOST")
                        .requestMatchers(HttpMethod.GET, "/api/official-concerts/nearby",
                                "/api/official-concerts/{id}").permitAll()
                        // /ws: l'autenticazione avviene al CONNECT (sezione 7.2).
                        // /error: altrimenti l'inoltro interno a /error diventa un 401 e il frontend fa logout.
                        .requestMatchers("/ws/**", "/error").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/superadmin/**").hasRole("SUPERADMIN")
                        .anyRequest().authenticated())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, e) -> writeError(response,
                                ErrorCode.UNAUTHENTICATED, "Token mancante, scaduto o non valido"))
                        .accessDeniedHandler((request, response, e) -> writeError(response,
                                ErrorCode.ACCESS_DENIED, "Ruolo insufficiente per questa risorsa")))
                .addFilterBefore(new JwtFilter(accessTokens, userAccess), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /**
     * Hash delle password con BCrypt (sezione 8.9). Statico per non creare la configurazione prima dei suoi bean.
     */
    @Bean
    public static PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Gerarchia di piattaforma (sezione 5.1): un SUPERADMIN supera i controlli hasRole("ADMIN"). ADMIN e
     * SUPERADMIN non ereditano MUSICIAN ne' HOST: i permessi di community restano separati. Statico
     * per non creare la configurazione prima dei suoi bean.
     */
    @Bean
    public static RoleHierarchy roleHierarchy() {
        return RoleHierarchyImpl.withDefaultRolePrefix()
                .role("SUPERADMIN").implies("ADMIN")
                .build();
    }

    /**
     * Scrive un ErrorResponse JSON per gli errori che nascono nei filtri, prima di arrivare a un controller.
     */
    private void writeError(HttpServletResponse response, ErrorCode code, String message) throws IOException {
        response.setStatus(code.httpStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        jsonMapper.writeValue(response.getOutputStream(),
                ErrorResponse.of(code, message, Map.of(), Map.of(), clock.instant()));
    }
}

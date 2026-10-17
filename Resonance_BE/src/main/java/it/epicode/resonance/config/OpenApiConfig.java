package it.epicode.resonance.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Descrizione OpenAPI delle API (decisione 5): titolo e schema Bearer JWT, cosi' la Swagger UI permette di
 * incollare l'access token e provare gli endpoint protetti.
 */
@Configuration
public class OpenApiConfig {

    static final String BEARER_SCHEME = "bearerAuth";

    /**
     * Metadati e schema di sicurezza. Il requisito Bearer e' globale: gli endpoint pubblici funzionano
     * lo stesso anche con il lucchetto attivo, perche' il filtro ignora un token assente o non valido (sezione 8.2).
     */
    @Bean
    public OpenAPI resonanceOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Resonance API")
                        .description("API della community musicale locale. L'access token (JWT) si ottiene con "
                                + "POST /api/auth/login e va inviato nell'header Authorization: Bearer.")
                        .version("v1"))
                .components(new Components().addSecuritySchemes(BEARER_SCHEME, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME));
    }
}

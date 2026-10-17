package it.epicode.resonance.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;
import java.time.Duration;

/**
 * Serve il frontend dallo stesso servizio dell'API (decisione 1, progettazione, sezioni 6.3 e 12.5): file
 * statici da {@code classpath:/static/} e, per le rotte di React Router, {@code index.html}. Finche' non
 * esiste il frontend la cartella e' vuota e questi percorsi rispondono 404 JSON.
 */
@Configuration
public class SpaResourceConfig implements WebMvcConfigurer {

    private static final String INDEX = "index.html";
    private static final String STATIC_LOCATION = "classpath:/static/";

    /**
     * Registra gli handler. Il mapping predefinito di Spring Boot e' disattivato in {@code application.yml}
     * (add-mappings: false) per avere un solo handler {@code /**}, quello con il fallback.
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Vite mette un hash nel nome dei file di /assets: il contenuto di un nome non cambia mai, quindi
        // la cache puo' durare un anno (sezione 12.5). Nessun fallback: un asset mancante e' un 404.
        registry.addResourceHandler("/assets/**")
                .addResourceLocations(STATIC_LOCATION + "assets/")
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable());

        // Tutto il resto, index.html compreso: no-cache, cioe' il browser rivalida a ogni apertura e dopo un
        // deploy carica subito i nuovi file con hash che index.html cita.
        registry.addResourceHandler("/**")
                .addResourceLocations(STATIC_LOCATION)
                .setCacheControl(CacheControl.noCache())
                .resourceChain(true)
                .addResolver(new SpaFallbackResolver());
    }

    /**
     * Dice se il percorso appartiene all'API o al WebSocket, mai al frontend. Usata anche da SecurityConfig
     * per rendere pubblici i soli GET che possono servire file statici o index.html.
     */
    public static boolean isApiOrWebSocketPath(String path) {
        String normalized = path.startsWith("/") ? path : "/" + path;
        return isUnder(normalized, "/api") || isUnder(normalized, "/ws");
    }

    /**
     * Dice se il percorso e' una rotta del frontend: fuori da {@code /api} e {@code /ws} e senza estensione
     * nell'ultimo segmento (un {@code .js} mancante e' un errore vero, non una rotta).
     */
    static boolean isFrontendPath(String path) {
        if (isApiOrWebSocketPath(path)) {
            return false;
        }
        return !path.substring(path.lastIndexOf('/') + 1).contains(".");
    }

    private static boolean isUnder(String path, String prefix) {
        return path.equals(prefix) || path.startsWith(prefix + "/");
    }

    /**
     * Cerca il file richiesto; se non c'e' e il percorso e' una rotta del frontend restituisce index.html.
     */
    private static final class SpaFallbackResolver extends PathResourceResolver {

        @Override
        protected Resource getResource(String resourcePath, Resource location) throws IOException {
            Resource requested = super.getResource(resourcePath, location);
            if (requested != null || !isFrontendPath(resourcePath)) {
                return requested;
            }
            Resource index = location.createRelative(INDEX);
            return index.exists() && index.isReadable() ? index : null;
        }
    }
}

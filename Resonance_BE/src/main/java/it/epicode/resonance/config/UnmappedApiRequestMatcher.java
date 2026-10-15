package it.epicode.resonance.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import org.springframework.http.server.RequestPath;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.servlet.handler.HandlerMappingIntrospector;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import org.springframework.web.util.ServletRequestPathUtils;

import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Riconosce le richieste {@code /api/...} per cui nessun controller ha un handler (progettazione,
 * sezione 6.3). SecurityConfig le lascia passare per prime, cosi' arrivano al DispatcherServlet e
 * rispondono 404 NOT_FOUND in JSON invece di 401 o 403. Un percorso che esiste ma con un metodo o un
 * tipo di contenuto diverso (l'handler solleva 405 o 415) NON e' "inesistente": segue le regole
 * normali, quindi risponde 401 o 403 prima del 405.
 * <p>
 * Si guardano solo i mapping dei controller: il mapping delle risorse statiche di Spring Boot
 * risponde a qualunque percorso e farebbe sembrare esistente ogni /api/...
 */
final class UnmappedApiRequestMatcher implements RequestMatcher {

    private final HandlerMappingIntrospector introspector;
    private volatile List<RequestMappingHandlerMapping> controllerMappings;

    UnmappedApiRequestMatcher(HandlerMappingIntrospector introspector) {
        this.introspector = introspector;
    }

    @Override
    public boolean matches(HttpServletRequest request) {
        // La ricerca scrive attributi sulla richiesta (variabili di percorso, pattern scelto): si fa su
        // una copia che li tiene per se', cosi' la ricerca vera del DispatcherServlet parte pulita.
        HttpServletRequest probe = new IsolatedAttributesRequest(request);
        RequestPath path = ServletRequestPathUtils.parseAndCache(probe);
        String value = path.pathWithinApplication().value();
        if (!value.equals("/api") && !value.startsWith("/api/")) {
            return false;
        }
        for (RequestMappingHandlerMapping mapping : controllerMappings()) {
            try {
                if (mapping.getHandler(probe) != null) {
                    return false;
                }
            } catch (Exception e) {
                // Il percorso esiste ma la richiesta non e' accettata (metodo, tipo di contenuto...).
                return false;
            }
        }
        return true;
    }

    /**
     * Mapping dei controller, letti al primo uso: all'avvio dell'applicazione potrebbero non essere
     * ancora pronti.
     */
    private List<RequestMappingHandlerMapping> controllerMappings() {
        List<RequestMappingHandlerMapping> mappings = controllerMappings;
        if (mappings == null) {
            mappings = introspector.getHandlerMappings().stream()
                    .filter(RequestMappingHandlerMapping.class::isInstance)
                    .map(RequestMappingHandlerMapping.class::cast)
                    .toList();
            controllerMappings = mappings;
        }
        return mappings;
    }

    /**
     * Richiesta che legge gli attributi di quella originale ma scrive solo nei propri.
     */
    private static final class IsolatedAttributesRequest extends HttpServletRequestWrapper {

        // Valore nullo = attributo rimosso nella copia.
        private final Map<String, Object> overrides = new HashMap<>();

        IsolatedAttributesRequest(HttpServletRequest request) {
            super(request);
        }

        @Override
        public Object getAttribute(String name) {
            return overrides.containsKey(name) ? overrides.get(name) : super.getAttribute(name);
        }

        @Override
        public void setAttribute(String name, Object value) {
            overrides.put(name, value);
        }

        @Override
        public void removeAttribute(String name) {
            overrides.put(name, null);
        }

        @Override
        public Enumeration<String> getAttributeNames() {
            Set<String> names = new HashSet<>(Collections.list(super.getAttributeNames()));
            overrides.forEach((name, value) -> {
                if (value == null) {
                    names.remove(name);
                } else {
                    names.add(name);
                }
            });
            return Collections.enumeration(names);
        }
    }
}

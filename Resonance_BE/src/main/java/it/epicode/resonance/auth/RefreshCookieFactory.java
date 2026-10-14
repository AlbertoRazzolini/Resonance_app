package it.epicode.resonance.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Costruisce il cookie del refresh token (progettazione, sezione 4.3): HttpOnly, limitato al percorso
 * del refresh, SameSite=Lax e Secure solo fuori da dev. Niente Domain: cookie del solo host.
 */
@Component
public class RefreshCookieFactory {

    public static final String COOKIE_NAME = "resonance_refresh";
    public static final String COOKIE_PATH = "/api/auth/refresh";

    private final boolean secure;
    private final Duration maxAge;

    public RefreshCookieFactory(@Value("${app.auth.refresh-cookie.secure}") boolean secure,
                                @Value("${app.auth.refresh-token-ttl}") Duration maxAge) {
        this.secure = secure;
        this.maxAge = maxAge;
    }

    /**
     * Cookie con il valore del refresh token; dura quanto il token (10 giorni, 864000 secondi).
     */
    public ResponseCookie create(String value) {
        return base(value).maxAge(maxAge).build();
    }

    /**
     * Cookie di cancellazione: stesso nome, Path, SameSite e Secure, Max-Age=0. Il browser lo cancella solo
     * se gli attributi coincidono con quelli del cookie originale.
     */
    public ResponseCookie clear() {
        return base("").maxAge(Duration.ZERO).build();
    }

    private ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(COOKIE_NAME, value)
                .httpOnly(true)
                .secure(secure)
                .path(COOKIE_PATH)
                .sameSite("Lax");
    }
}

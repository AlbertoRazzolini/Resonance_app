package it.epicode.resonance.auth;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseCookie;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Attributi del cookie del refresh token in sviluppo (senza Secure) e in produzione (con Secure) e
 * cancellazione con gli stessi attributi (progettazione, sezione 4.3).
 */
class RefreshCookieFactoryTest {

    private final RefreshCookieFactory dev = new RefreshCookieFactory(false, Duration.ofDays(10));
    private final RefreshCookieFactory prod = new RefreshCookieFactory(true, Duration.ofDays(10));

    @Test
    void create_inDev_hasAllAttributesExceptSecure() {
        ResponseCookie cookie = dev.create("valore");

        assertThat(cookie.getName()).isEqualTo("resonance_refresh");
        assertThat(cookie.getValue()).isEqualTo("valore");
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.isSecure()).isFalse();
        assertThat(cookie.getPath()).isEqualTo("/api/auth/refresh");
        assertThat(cookie.getMaxAge()).isEqualTo(Duration.ofSeconds(864000));
        assertThat(cookie.getSameSite()).isEqualTo("Lax");
        // Cookie del solo host: nessun Domain.
        assertThat(cookie.getDomain()).isNull();
        assertThat(cookie.toString()).doesNotContain("Secure");
    }

    @Test
    void create_inProd_isSecure() {
        ResponseCookie cookie = prod.create("valore");

        assertThat(cookie.isSecure()).isTrue();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.toString()).contains("Secure").contains("HttpOnly").contains("SameSite=Lax")
                .contains("Path=/api/auth/refresh").contains("Max-Age=864000");
    }

    @Test
    void clear_hasZeroMaxAgeAndTheSameAttributesAsTheOriginal() {
        // Il browser cancella il cookie solo se Path, SameSite e Secure coincidono con quelli originali.
        for (RefreshCookieFactory factory : new RefreshCookieFactory[]{dev, prod}) {
            ResponseCookie original = factory.create("valore");
            ResponseCookie cleared = factory.clear();

            assertThat(cleared.getName()).isEqualTo(original.getName());
            assertThat(cleared.getValue()).isEmpty();
            assertThat(cleared.getMaxAge()).isEqualTo(Duration.ZERO);
            assertThat(cleared.getPath()).isEqualTo(original.getPath());
            assertThat(cleared.getSameSite()).isEqualTo(original.getSameSite());
            assertThat(cleared.isSecure()).isEqualTo(original.isSecure());
            assertThat(cleared.isHttpOnly()).isTrue();
        }
    }
}

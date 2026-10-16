package it.epicode.resonance.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Carica i file YAML con il profilo "test" senza avviare il contesto applicativo:
 * niente DataSource e niente Flyway (progettazione, sezione 2.3).
 */
class ApplicationConfigTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withPropertyValues("spring.profiles.active=test");

    @Test
    void jwtSecret_resolvesAndIsLongEnoughForHs256() {
        runner.run(context -> {
            String secret = context.getEnvironment().getProperty("app.jwt.secret");

            assertThat(secret).isNotBlank();
            assertThat(secret.getBytes(StandardCharsets.UTF_8)).hasSizeGreaterThanOrEqualTo(32);
        });
    }

    @Test
    void rateLimits_resolveWithExpectedValues() {
        runner.run(context -> {
            Binder binder = Binder.get(context.getEnvironment());

            assertLimit(binder, "login-failed", 10, Duration.ofMinutes(15));
            assertLimit(binder, "chat-messages", 30, Duration.ofMinutes(1));
            assertLimit(binder, "conversations-created", 20, Duration.ofHours(24));
            assertLimit(binder, "collab-applications", 10, Duration.ofHours(24));
            assertLimit(binder, "friend-requests", 20, Duration.ofHours(24));
            assertLimit(binder, "user-search", 30, Duration.ofMinutes(1));
        });
    }

    @Test
    void geocoding_resolvesWithExpectedValues() {
        runner.run(context -> {
            Binder binder = Binder.get(context.getEnvironment());

            assertThat(binder.bind("app.geocoding.url", String.class).get())
                    .isEqualTo("https://nominatim.openstreetmap.org");
            assertThat(binder.bind("app.geocoding.connect-timeout", Duration.class).get())
                    .isEqualTo(Duration.ofSeconds(2));
            assertThat(binder.bind("app.geocoding.read-timeout", Duration.class).get())
                    .isEqualTo(Duration.ofSeconds(3));
            // Senza GEOCODING_CONTACT il valore e' vuoto, ma la chiave deve esistere.
            assertThat(context.getEnvironment().containsProperty("app.geocoding.contact")).isTrue();
        });
    }

    private static void assertLimit(Binder binder, String name, int max, Duration window) {
        String prefix = "app.rate-limits." + name;

        assertThat(binder.bind(prefix + ".max", Integer.class).get()).as(prefix + ".max").isEqualTo(max);
        assertThat(binder.bind(prefix + ".window", Duration.class).get()).as(prefix + ".window").isEqualTo(window);
    }
}

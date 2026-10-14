package it.epicode.resonance.common;

import it.epicode.resonance.support.MutableClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Limiti di frequenza in memoria con finestra che scorre, provati avanzando un orologio finto
 * (progettazione, sezione 8.8).
 */
class RateLimitServiceTest {

    private static final String KEY = "mario@example.com";

    private MutableClock clock;
    private RateLimitService service;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-10-14T10:00:00Z"));
        service = new RateLimitService(clock, environmentWith(3, "15m"));
    }

    private static MockEnvironment environmentWith(int max, String window) {
        MockEnvironment environment = new MockEnvironment();
        for (RateLimit limit : RateLimit.values()) {
            String prefix = "app.rate-limits." + limit.name().toLowerCase().replace('_', '-');
            environment.setProperty(prefix + ".max", String.valueOf(max));
            environment.setProperty(prefix + ".window", window);
        }
        return environment;
    }

    private void assertTooManyRequests(Runnable action) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(AppException.class,
                        ex -> assertThat(ex.getCode()).isEqualTo(ErrorCode.TOO_MANY_REQUESTS));
    }

    @Test
    void consume_blocksWhenTheLimitIsReached() {
        for (int i = 0; i < 3; i++) {
            service.consume(RateLimit.CHAT_MESSAGES, KEY);
        }

        assertTooManyRequests(() -> service.consume(RateLimit.CHAT_MESSAGES, KEY));
    }

    @Test
    void consume_allowsAgainWhenTheWindowHasPassed() {
        for (int i = 0; i < 3; i++) {
            service.consume(RateLimit.CHAT_MESSAGES, KEY);
        }

        clock.advance(Duration.ofMinutes(15).plusSeconds(1));

        assertThatCode(() -> service.consume(RateLimit.CHAT_MESSAGES, KEY)).doesNotThrowAnyException();
    }

    @Test
    void consume_slidesTheWindowInsteadOfResettingIt() {
        service.consume(RateLimit.CHAT_MESSAGES, KEY);
        clock.advance(Duration.ofMinutes(10));
        service.consume(RateLimit.CHAT_MESSAGES, KEY);
        service.consume(RateLimit.CHAT_MESSAGES, KEY);
        assertTooManyRequests(() -> service.consume(RateLimit.CHAT_MESSAGES, KEY));

        // Dopo altri 6 minuti il primo evento (a 16 minuti da adesso) e' uscito dalla finestra, gli altri due no.
        clock.advance(Duration.ofMinutes(6));

        assertThatCode(() -> service.consume(RateLimit.CHAT_MESSAGES, KEY)).doesNotThrowAnyException();
        assertTooManyRequests(() -> service.consume(RateLimit.CHAT_MESSAGES, KEY));
    }

    @Test
    void keys_areIndependent() {
        for (int i = 0; i < 3; i++) {
            service.consume(RateLimit.CHAT_MESSAGES, KEY);
        }

        assertThatCode(() -> service.consume(RateLimit.CHAT_MESSAGES, "altro@example.com"))
                .doesNotThrowAnyException();
    }

    @Test
    void limits_areIndependent() {
        for (int i = 0; i < 3; i++) {
            service.consume(RateLimit.CHAT_MESSAGES, KEY);
        }

        assertThatCode(() -> service.consume(RateLimit.CONVERSATIONS_CREATED, KEY)).doesNotThrowAnyException();
    }

    @Test
    void check_doesNotRecordAnything() {
        for (int i = 0; i < 10; i++) {
            service.check(RateLimit.LOGIN_FAILED, KEY);
        }

        assertThatCode(() -> service.check(RateLimit.LOGIN_FAILED, KEY)).doesNotThrowAnyException();
    }

    @Test
    void recordThenCheck_blocksAtTheLimit() {
        // Uso del login: contano solo i tentativi falliti (progettazione, sezione 8.8).
        for (int i = 0; i < 3; i++) {
            service.check(RateLimit.LOGIN_FAILED, KEY);
            service.record(RateLimit.LOGIN_FAILED, KEY);
        }

        assertTooManyRequests(() -> service.check(RateLimit.LOGIN_FAILED, KEY));
    }

    @Test
    void reset_clearsTheKey() {
        for (int i = 0; i < 3; i++) {
            service.record(RateLimit.LOGIN_FAILED, KEY);
        }
        assertTooManyRequests(() -> service.check(RateLimit.LOGIN_FAILED, KEY));

        service.reset(RateLimit.LOGIN_FAILED, KEY);

        assertThatCode(() -> service.check(RateLimit.LOGIN_FAILED, KEY)).doesNotThrowAnyException();
    }

    @Test
    void cleanExpired_keepsRecentEventsAndDropsOldOnes() {
        for (int i = 0; i < 3; i++) {
            service.consume(RateLimit.CHAT_MESSAGES, KEY);
        }

        clock.advance(Duration.ofMinutes(5));
        service.cleanExpired();
        assertTooManyRequests(() -> service.consume(RateLimit.CHAT_MESSAGES, KEY));

        clock.advance(Duration.ofMinutes(11));
        service.cleanExpired();
        assertThatCode(() -> service.consume(RateLimit.CHAT_MESSAGES, KEY)).doesNotThrowAnyException();
    }

    @Test
    void constructor_failsWhenALimitIsNotConfigured() {
        // Un limite senza configurazione ferma l'avvio invece di non limitare niente.
        assertThatThrownBy(() -> new RateLimitService(clock, new MockEnvironment()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("app.rate-limits.login-failed");
    }

    @Test
    void constructor_failsWhenALimitIsNotValid() {
        assertThatThrownBy(() -> new RateLimitService(clock, environmentWith(0, "15m")))
                .isInstanceOf(IllegalStateException.class);
    }
}

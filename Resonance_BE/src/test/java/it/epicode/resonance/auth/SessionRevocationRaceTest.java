package it.epicode.resonance.auth;

import it.epicode.resonance.auth.dto.LoginRequest;
import it.epicode.resonance.auth.dto.ResetPasswordRequest;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Un reset della password in parallelo con un refresh o con un login non deve lasciare un refresh token valido
 * (progettazione, sezioni 4.8, 4.10 e 4.11; decisione 76, S1). La sessione si ferma con un latch prima del commit:
 * senza il lock sulla riga dell'utente il reset termina in mezzo e non vede il token nuovo, che resta valido.
 */
class SessionRevocationRaceTest extends IntegrationTest {

    private static final String PASSWORD = "password-corretta";
    private static final String NEW_PASSWORD = "password-nuova-1";
    // Attesa massima del commit: con il lock il reset non puo' finire prima, quindi l'attesa scade (3 s per prova).
    private static final long COMMIT_HOLD_SECONDS = 3;

    @Autowired
    private UserRepository users;

    @Autowired
    private RefreshTokenRepository tokens;

    @Autowired
    private RefreshTokenService refreshTokens;

    @Autowired
    private AuthService authService;

    @Autowired
    private EmailCodeService emailCodes;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private TransactionTemplate transaction;

    private User user;

    @BeforeEach
    void createUser() {
        User created = new User("mario-" + UUID.randomUUID() + "@example.com", passwordEncoder.encode(PASSWORD), "Mario");
        created.setEmailVerified(true);
        user = users.save(created);
    }

    @Test
    void refresh_racingWithAPasswordReset_leavesNoValidRefreshToken() throws Exception {
        IssuedRefreshToken first = refreshTokens.create(user.getId());

        resetWhileSessionIsOpening(() -> refreshTokens.rotate(first.value()));

        assertThat(validTokensOfTheUser()).isEmpty();
    }

    @Test
    void login_racingWithAPasswordReset_leavesNoValidRefreshToken() throws Exception {
        resetWhileSessionIsOpening(() -> authService.login(new LoginRequest(user.getEmail(), PASSWORD)));

        assertThat(validTokensOfTheUser()).isEmpty();
    }

    /**
     * Apre la sessione in una transazione che resta aperta, lancia il reset in un altro thread e solo dopo fa il
     * commit della sessione (o dopo l'attesa massima, se il reset e' in coda sul lock).
     */
    private void resetWhileSessionIsOpening(Runnable openSession) throws Exception {
        String code = emailCodes.issue(user.getId(), EmailCodePurpose.PASSWORD_RESET);
        CountDownLatch sessionOpened = new CountDownLatch(1);
        CountDownLatch resetDone = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> session = pool.submit(() -> transaction.executeWithoutResult(status -> {
                openSession.run();
                sessionOpened.countDown();
                try {
                    resetDone.await(COMMIT_HOLD_SECONDS, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }));
            assertThat(sessionOpened.await(30, TimeUnit.SECONDS)).isTrue();
            Future<?> reset = pool.submit(() -> {
                authService.resetPassword(new ResetPasswordRequest(user.getEmail(), code, NEW_PASSWORD));
                resetDone.countDown();
            });
            session.get(30, TimeUnit.SECONDS);
            reset.get(30, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }
    }

    private List<RefreshToken> validTokensOfTheUser() {
        return tokens.findAll().stream()
                .filter(token -> token.getUserId().equals(user.getId()) && !token.isRevoked())
                .toList();
    }
}

package it.epicode.resonance.auth;

import it.epicode.resonance.auth.dto.LoginRequest;
import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.RateLimit;
import it.epicode.resonance.common.RateLimitService;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Parte del login che non dipende dal database: il confronto BCrypt fittizio per le email sconosciute, che
 * rende uguale il tempo di risposta con un'email sconosciuta e con una password errata (decisione 48).
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String DUMMY_HASH = "hash-fittizio-calcolato-all-avvio";

    @Mock
    private UserRepository users;
    @Mock
    private UserRoleRepository userRoles;
    @Mock
    private UserAccessService userAccess;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private RateLimitService rateLimits;
    @Mock
    private AccessTokenService accessTokens;
    @Mock
    private RefreshTokenService refreshTokens;
    @Mock
    private EmailCodeService emailCodes;
    @Mock
    private ApplicationEventPublisher events;

    private AuthService service;

    @BeforeEach
    void createService() {
        when(passwordEncoder.encode(anyString())).thenReturn(DUMMY_HASH);
        service = new AuthService(users, userRoles, userAccess, passwordEncoder, rateLimits, accessTokens, refreshTokens,
                emailCodes, events);
    }

    @Test
    void login_withUnknownEmail_stillComparesTheDummyHash() {
        when(users.findByEmail("nessuno@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.login(new LoginRequest("nessuno@example.com", "password-qualsiasi")))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.INVALID_CREDENTIALS));

        // Il costo di BCrypt si paga anche qui: senza, la risposta sarebbe molto piu' veloce (decisione 48).
        verify(passwordEncoder).matches("password-qualsiasi", DUMMY_HASH);
        verify(rateLimits).record(RateLimit.LOGIN_FAILED, "nessuno@example.com");
    }

    @Test
    void login_withWrongPassword_comparesTheHashOfTheUser() {
        User user = new User("mario@example.com", "hash-vero", "Mario");
        when(users.findByEmail("mario@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.login(new LoginRequest("mario@example.com", "sbagliata")))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.INVALID_CREDENTIALS));

        verify(passwordEncoder).matches("sbagliata", "hash-vero");
        verify(passwordEncoder, never()).matches("sbagliata", DUMMY_HASH);
    }

    @Test
    void login_dummyHashNeverAuthenticates_evenIfTheEncoderSaidItMatches() {
        // Difesa in profondita': l'esito del confronto fittizio si scarta, un'email sconosciuta non entra mai.
        when(users.findByEmail("nessuno@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);

        assertThatThrownBy(() -> service.login(new LoginRequest("nessuno@example.com", "password-qualsiasi")))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.INVALID_CREDENTIALS));
        verify(userAccess, never()).resolve(any());
        verify(refreshTokens, never()).create(any());
    }

    @Test
    void dummyHash_isComputedOnceAtStartupWithTheSameEncoder() {
        when(users.findByEmail(anyString())).thenReturn(Optional.empty());

        for (int i = 0; i < 3; i++) {
            assertThatThrownBy(() -> service.login(new LoginRequest("nessuno@example.com", "password-qualsiasi")))
                    .isInstanceOf(AppException.class);
        }

        // Una sola codifica, nel costruttore: non si ricalcola a ogni login.
        verify(passwordEncoder, times(1)).encode(anyString());
    }

    @Test
    void login_withPasswordOver72Bytes_skipsBcryptForKnownAndUnknownEmailAlike() {
        // 30 emoji: 120 byte. Oltre i 72 byte non si chiama BCrypt ne' per un utente vero ne' per il confronto fittizio.
        String emojis = "😀".repeat(30);
        when(users.findByEmail("mario@example.com"))
                .thenReturn(Optional.of(new User("mario@example.com", "hash-vero", "Mario")));
        when(users.findByEmail("nessuno@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.login(new LoginRequest("mario@example.com", emojis)))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> service.login(new LoginRequest("nessuno@example.com", emojis)))
                .isInstanceOf(AppException.class);

        verify(passwordEncoder, never()).matches(anyString(), anyString());
    }
}

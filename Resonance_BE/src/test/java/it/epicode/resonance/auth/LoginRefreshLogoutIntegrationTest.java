package it.epicode.resonance.auth;

import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Login, refresh con rotazione e logout via HTTP, con la vera catena di sicurezza (progettazione, sezioni
 * 4.7-4.9 e 8.5). Gli utenti si creano direttamente nel database; l'email cambia a ogni test perche' il
 * limite dei fallimenti e' in memoria e sopravvive fra un test e l'altro.
 */
class LoginRefreshLogoutIntegrationTest extends IntegrationTest {

    private static final String PASSWORD = "password-corretta";
    private static final String COOKIE = "resonance_refresh";

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private RefreshTokenRepository refreshTokens;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AccessTokenService accessTokens;

    private String email;

    @BeforeEach
    void createUser() {
        email = "mario-" + UUID.randomUUID() + "@example.com";
    }

    // ---------------------------------------------------------------- login

    @Test
    void login_withCorrectCredentials_returnsTokenProfileAndRefreshCookie() throws Exception {
        User user = verifiedUser(email);

        login(email, PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.accessTokenExpiresAt").isNotEmpty())
                // L'id c'e' solo nel proprio profilo: serve a riconoscere i propri contenuti.
                .andExpect(jsonPath("$.user.id").value(user.getId().toString()))
                .andExpect(jsonPath("$.user.email").value(email))
                .andExpect(jsonPath("$.user.roles[0]").value("FAN"))
                .andExpect(jsonPath("$.user.status").value("ACTIVE"))
                // Il refresh token e l'hash non sono mai nel body.
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist())
                .andExpect(header().string("Set-Cookie", containsString("resonance_refresh=")))
                .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
                .andExpect(header().string("Set-Cookie", containsString("Path=/api/auth/refresh")))
                .andExpect(header().string("Set-Cookie", containsString("SameSite=Lax")))
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=864000")));
    }

    @Test
    void login_accessTokenIdentifiesTheUser() throws Exception {
        User user = verifiedUser(email);

        String body = login(email, PASSWORD).andReturn().getResponse().getContentAsString();
        String token = com.jayway.jsonpath.JsonPath.read(body, "$.accessToken");

        // Il token si legge con lo stesso service che lo ha emesso: il sub e' l'id dell'utente.
        assertThat(accessTokens.parse(token)).hasValueSatisfying(claims ->
                assertThat(claims.userId()).isEqualTo(user.getId()));
    }

    @Test
    void login_withWrongPassword_returns401InvalidCredentialsWithoutCookie() throws Exception {
        verifiedUser(email);

        login(email, "password-sbagliata")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    void login_withUnknownEmail_returnsTheSameResponseAsWrongPassword() throws Exception {
        verifiedUser(email);
        String wrongPassword = login(email, "password-sbagliata").andReturn().getResponse().getContentAsString();

        String unknownEmail = login("nessuno-" + UUID.randomUUID() + "@example.com", PASSWORD)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andReturn().getResponse().getContentAsString();

        // Stesso messaggio: non si rivela se l'email esiste.
        assertThat(com.jayway.jsonpath.JsonPath.<String>read(unknownEmail, "$.message"))
                .isEqualTo(com.jayway.jsonpath.JsonPath.<String>read(wrongPassword, "$.message"));
    }

    @Test
    void login_normalizesEmail() throws Exception {
        verifiedUser(email);

        // Spazi e maiuscole: lo stesso utente registrato in minuscolo (review focus 1).
        login("  " + email.toUpperCase() + " ", PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value(email));
    }

    @Test
    void login_withMultibytePasswordOver72Bytes_returns401WithoutException() throws Exception {
        verifiedUser(email);
        // 30 emoji: 30 caratteri ma 120 byte. BCrypt non deve essere chiamato (review focus 2).
        String emojiPassword = "😀".repeat(30);

        login(email, emojiPassword)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void login_withUnverifiedEmail_returns403OnlyAfterTheCorrectPassword() throws Exception {
        User unverified = new User(email, passwordEncoder.encode(PASSWORD), "Mario");
        users.save(unverified);

        login(email, PASSWORD)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"))
                .andExpect(header().doesNotExist("Set-Cookie"));
        // Con la password sbagliata non si scopre che l'email esiste ma non e' verificata.
        login(email, "password-sbagliata")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void login_whenSuspended_returns403WithReasonAndEnd() throws Exception {
        Instant until = clock.instant().plus(Duration.ofDays(3));
        suspend(verifiedUser(email), until);

        login(email, PASSWORD)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"))
                .andExpect(jsonPath("$.details.suspensionReason").value("Linguaggio offensivo"))
                .andExpect(jsonPath("$.details.suspendedUntil").isNotEmpty())
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    void login_whenSuspendedWithWrongPassword_returns401WithoutRevealingTheSuspension() throws Exception {
        suspend(verifiedUser(email), clock.instant().plus(Duration.ofDays(3)));

        // ACCOUNT_SUSPENDED e i suoi dettagli compaiono solo con la password giusta (progettazione, sezione 4.7).
        login(email, "password-sbagliata")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.details.suspensionReason").doesNotExist())
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    void login_whenSuspendedWithoutEnd_hasNullSuspendedUntil() throws Exception {
        suspend(verifiedUser(email), null);

        login(email, PASSWORD)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"))
                .andExpect(jsonPath("$.details.suspensionReason").value("Linguaggio offensivo"))
                .andExpect(jsonPath("$.details.suspendedUntil").value((Object) null));
    }

    @Test
    void login_afterSuspensionEnded_reactivatesUserAndSucceeds() throws Exception {
        User user = suspend(verifiedUser(email), clock.instant().plus(Duration.ofDays(1)));
        clock.advance(Duration.ofDays(2));

        login(email, PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.status").value("ACTIVE"));
        assertThat(users.findById(user.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Test
    void login_afterTenFailures_returns429EvenWithTheCorrectPassword() throws Exception {
        verifiedUser(email);
        for (int i = 0; i < 10; i++) {
            login(email, "password-sbagliata").andExpect(status().isUnauthorized());
        }

        // L'11° tentativo e' bloccato, anche con la password giusta.
        login(email, PASSWORD)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));

        // Passata la finestra di 15 minuti si puo' riprovare.
        clock.advance(Duration.ofMinutes(16));
        login(email, PASSWORD).andExpect(status().isOk());
    }

    @Test
    void login_twentyParallelFailures_areExactlyTenUnauthorizedAndTenTooManyRequests() throws Exception {
        verifiedUser(email);
        int attempts = 20;
        ExecutorService pool = Executors.newFixedThreadPool(attempts);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Integer>> results = new ArrayList<>();
            for (int i = 0; i < attempts; i++) {
                results.add(pool.submit(() -> {
                    start.await();
                    return login(email, "password-sbagliata").andReturn().getResponse().getStatus();
                }));
            }
            start.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> result : results) {
                statuses.add(result.get(60, TimeUnit.SECONDS));
            }

            // Il tentativo si prenota prima di BCrypt (S2, decisione 76): con check + record passerebbero quasi tutti.
            assertThat(statuses.stream().filter(code -> code == 401).count()).isEqualTo(10);
            assertThat(statuses.stream().filter(code -> code == 429).count()).isEqualTo(10);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void login_withCorrectPasswordButUnverifiedEmail_neverCountsAsFailure() throws Exception {
        User user = verifiedUser(email);
        user.setEmailVerified(false);
        users.save(user);

        // Piu' dei 10 tentativi consentiti: il tentativo prenotato si restituisce (release, decisione 48).
        for (int i = 0; i < 12; i++) {
            login(email, PASSWORD).andExpect(status().isForbidden());
        }
    }

    @Test
    void login_withCorrectPasswordWhileSuspended_neverCountsAsFailure() throws Exception {
        suspend(verifiedUser(email), null);

        for (int i = 0; i < 12; i++) {
            login(email, PASSWORD).andExpect(status().isForbidden());
        }
    }

    @Test
    void login_succeeding_resetsTheFailureCounter() throws Exception {
        verifiedUser(email);
        for (int i = 0; i < 9; i++) {
            login(email, "password-sbagliata").andExpect(status().isUnauthorized());
        }
        login(email, PASSWORD).andExpect(status().isOk());

        // Altri 9 fallimenti non scattano il limite: il contatore e' ripartito da zero.
        for (int i = 0; i < 9; i++) {
            login(email, "password-sbagliata").andExpect(status().isUnauthorized());
        }
        login(email, PASSWORD).andExpect(status().isOk());
    }

    @Test
    void login_withInvalidBody_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"non-una-email\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.email").exists())
                .andExpect(jsonPath("$.fields.password").exists());
    }

    @Test
    void login_errorsNeverContainThePassword() throws Exception {
        verifiedUser(email);

        login(email, "password-sbagliata-segreta")
                .andExpect(content().string(not(containsString("password-sbagliata-segreta"))));
    }

    // -------------------------------------------------------------- refresh

    @Test
    void refresh_withoutCsrfHeader_returns403() throws Exception {
        verifiedUser(email);
        String cookie = loginCookie();

        mockMvc.perform(post("/api/auth/refresh").cookie(new Cookie(COOKIE, cookie)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_HEADER_MISSING"));
        // La richiesta respinta non ha consumato il token.
        assertThat(refreshTokens.findAll()).noneMatch(RefreshToken::isRevoked);
    }

    @Test
    void refresh_withForeignOrigin_returns403() throws Exception {
        verifiedUser(email);
        String cookie = loginCookie();

        mockMvc.perform(refresh(cookie).header("Origin", "https://evil.example"))
                .andExpect(status().isForbidden());
        assertThat(refreshTokens.findAll()).noneMatch(RefreshToken::isRevoked);
    }

    @Test
    void refresh_withOriginSpoofingTheServiceHostAsPrefix_returns403() throws Exception {
        verifiedUser(email);
        String cookie = loginCookie();

        // Non basta che il nome inizi come quello del servizio: l'host deve coincidere esattamente.
        mockMvc.perform(refresh(cookie).header("Origin", "http://localhost.evil.example"))
                .andExpect(status().isForbidden());
    }

    @Test
    void refresh_withOriginOfTheServiceItself_isAccepted() throws Exception {
        verifiedUser(email);
        String cookie = loginCookie();

        mockMvc.perform(refresh(cookie).header("Origin", "http://localhost"))
                .andExpect(status().isOk());
    }

    @Test
    void refresh_rotatesTheTokenAndReturnsNewAccessTokenAndCookie() throws Exception {
        User user = verifiedUser(email);
        String first = loginCookie();
        clock.advance(Duration.ofMinutes(20));

        MvcResult result = mockMvc.perform(refresh(first))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.id").value(user.getId().toString()))
                .andExpect(jsonPath("$.user.email").value(email))
                .andExpect(jsonPath("$.user.roles[0]").value("FAN"))
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
                .andReturn();
        String second = cookieValue(result);

        assertThat(second).isNotEqualTo(first).hasSize(43);
        RefreshToken old = tokenOf(first);
        RefreshToken fresh = tokenOf(second);
        assertThat(old.getUserId()).isEqualTo(user.getId());
        assertThat(old.isRevoked()).isTrue();
        assertThat(old.getReplacedBy()).isEqualTo(fresh.getId());
        assertThat(fresh.isRevoked()).isFalse();
        // Il nuovo cookie funziona a sua volta.
        clock.advance(Duration.ofMinutes(20));
        mockMvc.perform(refresh(second)).andExpect(status().isOk());
    }

    @Test
    void refresh_worksWithAnExpiredOrInvalidBearer() throws Exception {
        verifiedUser(email);
        String cookie = loginCookie();

        // L'access token e' scaduto proprio perche' si fa il refresh: l'endpoint e' pubblico e non lo guarda.
        mockMvc.perform(refresh(cookie).header("Authorization", "Bearer token-scaduto-o-malformato"))
                .andExpect(status().isOk());
    }

    @Test
    void refresh_withoutCookie_returns401AndClearsTheCookie() throws Exception {
        mockMvc.perform(post("/api/auth/refresh").header("X-Requested-With", "XMLHttpRequest"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_INVALID"))
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")));
    }

    @Test
    void refresh_withUnknownCookie_returns401AndClearsTheCookie() throws Exception {
        mockMvc.perform(refresh("valore-mai-emesso"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_INVALID"))
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")))
                .andExpect(header().string("Set-Cookie", containsString("Path=/api/auth/refresh")));
    }

    @Test
    void refresh_afterTenDays_returns401Expired() throws Exception {
        verifiedUser(email);
        String cookie = loginCookie();
        clock.advance(Duration.ofDays(10).plusSeconds(1));

        mockMvc.perform(refresh(cookie))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_EXPIRED"))
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")));
    }

    @Test
    void refresh_twiceWithTheSameCookieOneSecondApart_secondIs409AndNothingIsRevoked() throws Exception {
        verifiedUser(email);
        String first = loginCookie();
        String second = cookieValue(mockMvc.perform(refresh(first)).andExpect(status().isOk()).andReturn());
        clock.advance(Duration.ofSeconds(1));

        // Due schede con lo stesso cookie: la seconda perde la corsa e non tocca il cookie nuovo.
        mockMvc.perform(refresh(first))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REFRESH_CONFLICT"))
                .andExpect(header().doesNotExist("Set-Cookie"));
        mockMvc.perform(refresh(second)).andExpect(status().isOk());
    }

    @Test
    void refresh_reusingARotatedCookieAfterTenSeconds_revokesEverythingAndReturns401() throws Exception {
        verifiedUser(email);
        String first = loginCookie();
        String second = cookieValue(mockMvc.perform(refresh(first)).andExpect(status().isOk()).andReturn());
        String otherDevice = loginCookie();
        clock.advance(Duration.ofSeconds(11));

        mockMvc.perform(refresh(first))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_REUSED"))
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")));

        // La revoca totale e' stata salvata nonostante la risposta di errore.
        assertThat(refreshTokens.findAll()).allMatch(RefreshToken::isRevoked);
        mockMvc.perform(refresh(second)).andExpect(status().isUnauthorized());
        mockMvc.perform(refresh(otherDevice)).andExpect(status().isUnauthorized());
    }

    @Test
    void refresh_whenTheUserGotSuspended_returns403WithDetailsAndRevokesEverything() throws Exception {
        User user = verifiedUser(email);
        String cookie = loginCookie();
        suspend(user, clock.instant().plus(Duration.ofDays(3)));

        mockMvc.perform(refresh(cookie))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"))
                .andExpect(jsonPath("$.details.suspensionReason").value("Linguaggio offensivo"))
                .andExpect(jsonPath("$.details.suspendedUntil").isNotEmpty())
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")));
        assertThat(refreshTokens.findAll()).allMatch(RefreshToken::isRevoked);
    }

    // --------------------------------------------------------------- logout

    @Test
    void logout_returns204ClearsTheCookieAndRevokesOnlyThatToken() throws Exception {
        verifiedUser(email);
        String mine = loginCookie();
        String otherDevice = loginCookie();

        mockMvc.perform(logout(mine))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")))
                .andExpect(header().string("Set-Cookie", containsString("Path=/api/auth/refresh")));

        assertThat(refreshTokens.findAll()).filteredOn(RefreshToken::isRevoked).hasSize(1);
        // L'altro dispositivo continua a funzionare.
        mockMvc.perform(refresh(otherDevice)).andExpect(status().isOk());
    }

    @Test
    void refresh_afterLogout_returns401ReusedAndRevokesAllTheUsersTokens() throws Exception {
        verifiedUser(email);
        String loggedOut = loginCookie();
        String otherDevice = loginCookie();
        mockMvc.perform(logout(loggedOut)).andExpect(status().isNoContent());

        // Token revocato senza replaced_by: la finestra di tolleranza non si applica (sezione 4.8, passo 4).
        mockMvc.perform(refresh(loggedOut))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_REUSED"));

        assertThat(refreshTokens.findAll()).allMatch(RefreshToken::isRevoked);
        mockMvc.perform(refresh(otherDevice)).andExpect(status().isUnauthorized());
    }

    @Test
    void logout_withoutCookie_stillReturns204AndClearsTheCookie() throws Exception {
        mockMvc.perform(delete("/api/auth/refresh").header("X-Requested-With", "XMLHttpRequest"))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")));
    }

    @Test
    void logout_withUnknownCookieAndInvalidBearer_returns204() throws Exception {
        // Idempotente e senza Bearer: funziona anche con l'access token scaduto.
        mockMvc.perform(logout("valore-mai-emesso").header("Authorization", "Bearer token-scaduto"))
                .andExpect(status().isNoContent());
    }

    @Test
    void logout_withoutCsrfHeader_returns403AndKeepsTheToken() throws Exception {
        verifiedUser(email);
        String cookie = loginCookie();

        mockMvc.perform(delete("/api/auth/refresh").cookie(new Cookie(COOKIE, cookie)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_HEADER_MISSING"));
        assertThat(refreshTokens.findAll()).noneMatch(RefreshToken::isRevoked);
    }

    @Test
    void logout_withForeignOrigin_returns403AndKeepsTheToken() throws Exception {
        verifiedUser(email);
        String cookie = loginCookie();

        mockMvc.perform(logout(cookie).header("Origin", "https://evil.example"))
                .andExpect(status().isForbidden());
        assertThat(refreshTokens.findAll()).noneMatch(RefreshToken::isRevoked);
    }

    // -------------------------------------------------------------- helper

    private RefreshToken tokenOf(String cookieValue) {
        String hash = RefreshTokenService.hash(cookieValue);
        return refreshTokens.findAll().stream()
                .filter(token -> token.getTokenHash().equals(hash))
                .findFirst().orElseThrow();
    }

    /**
     * Fa un login riuscito e restituisce il valore del cookie di refresh.
     */
    private String loginCookie() throws Exception {
        return cookieValue(login(email, PASSWORD).andExpect(status().isOk()).andReturn());
    }

    private static String cookieValue(MvcResult result) {
        String setCookie = result.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).startsWith(COOKIE + "=");
        return setCookie.substring((COOKIE + "=").length(), setCookie.indexOf(';'));
    }

    private static MockHttpServletRequestBuilder refresh(String cookie) {
        return post("/api/auth/refresh").cookie(new Cookie(COOKIE, cookie)).header("X-Requested-With", "XMLHttpRequest");
    }

    private static MockHttpServletRequestBuilder logout(String cookie) {
        return delete("/api/auth/refresh").cookie(new Cookie(COOKIE, cookie)).header("X-Requested-With", "XMLHttpRequest");
    }

    private ResultActions login(String loginEmail, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + loginEmail + "\",\"password\":\"" + password + "\"}"));
    }

    private User verifiedUser(String userEmail) {
        User user = new User(userEmail, passwordEncoder.encode(PASSWORD), "Mario");
        user.setEmailVerified(true);
        user = users.save(user);
        roles.save(new UserRole(user.getId(), Role.FAN));
        return user;
    }

    private User suspend(User user, Instant until) {
        // La sospensione richiede un autore (ck_users_suspension e fk_users_suspended_by).
        User moderator = users.save(new User("admin-" + UUID.randomUUID() + "@example.com", "hash-di-prova", "Admin"));
        user.setStatus(UserStatus.SUSPENDED);
        user.setSuspendedAt(clock.instant());
        user.setSuspendedBy(moderator.getId());
        user.setSuspensionReason("Linguaggio offensivo");
        user.setSuspendedUntil(until);
        return users.save(user);
    }
}

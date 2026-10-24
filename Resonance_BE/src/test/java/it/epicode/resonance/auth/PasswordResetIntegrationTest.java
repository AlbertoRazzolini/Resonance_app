package it.epicode.resonance.auth;

import it.epicode.resonance.mail.PasswordChangedEmailEvent;
import it.epicode.resonance.mail.PasswordResetCodeEmailEvent;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Password dimenticata e reset via HTTP, con la vera catena di sicurezza (progettazione, sezioni 4.10 e
 * 4.11). Il codice si legge dall'evento email pubblicato, come farebbe il listener. Verifica soprattutto
 * che il reset revochi tutte le sessioni e che i codici non rivelino quali email esistono.
 */
@RecordApplicationEvents
class PasswordResetIntegrationTest extends IntegrationTest {

    private static final String EMAIL = "mario@example.com";
    private static final String OLD_PASSWORD = "vecchia-password";
    private static final String NEW_PASSWORD = "nuova-password-1";

    @Autowired
    private ApplicationEvents events;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private EmailCodeRepository codes;

    @Autowired
    private RefreshTokenRepository refreshTokens;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JsonMapper json;

    // --------------------------------------------------------------- forgot

    @Test
    void forgot_forAVerifiedActiveUser_returns204AndPublishesTheResetCode() throws Exception {
        User user = verifiedUser(EMAIL);

        forgot(EMAIL).andExpect(status().isNoContent());

        PasswordResetCodeEmailEvent event = lastCodeEvent();
        assertThat(event.recipient()).isEqualTo(EMAIL);
        assertThat(event.code()).matches("\\d{6}");
        assertThat(codes.findByUserIdAndPurpose(user.getId(), EmailCodePurpose.PASSWORD_RESET).orElseThrow()
                .getCode()).isEqualTo(event.code());
    }

    @Test
    void forgot_normalizesTheEmail() throws Exception {
        verifiedUser(EMAIL);

        forgot("  Mario@Example.COM ").andExpect(status().isNoContent());

        assertThat(lastCodeEvent().recipient()).isEqualTo(EMAIL);
    }

    @Test
    void forgot_forAnUnknownEmail_returns204WithoutSendingAnything() throws Exception {
        forgot("sconosciuto@example.com").andExpect(status().isNoContent());

        assertThat(events.stream(PasswordResetCodeEmailEvent.class)).isEmpty();
        assertThat(codes.count()).isZero();
    }

    @Test
    void forgot_forAnUnverifiedUser_returns204WithoutSendingAnything() throws Exception {
        users.save(new User(EMAIL, passwordEncoder.encode(OLD_PASSWORD), "Mario"));

        forgot(EMAIL).andExpect(status().isNoContent());

        assertThat(events.stream(PasswordResetCodeEmailEvent.class)).isEmpty();
        assertThat(codes.count()).isZero();
    }

    @Test
    void forgot_forASuspendedUser_returns204WithoutSendingAnything() throws Exception {
        User user = verifiedUser(EMAIL);
        suspend(user);

        forgot(EMAIL).andExpect(status().isNoContent());

        assertThat(events.stream(PasswordResetCodeEmailEvent.class)).isEmpty();
    }

    @Test
    void forgot_twiceWithinSixtySeconds_returns429() throws Exception {
        verifiedUser(EMAIL);
        forgot(EMAIL).andExpect(status().isNoContent());

        forgot(EMAIL)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));

        assertThat(events.stream(PasswordResetCodeEmailEvent.class).toList()).hasSize(1);
    }

    @Test
    void forgot_withoutEmail_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/password/forgot").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.email").exists());
    }

    // ---------------------------------------------------------------- reset

    @Test
    void reset_withTheRightCode_changesThePasswordAndClearsTheCookie() throws Exception {
        verifiedUser(EMAIL);
        forgot(EMAIL).andExpect(status().isNoContent());
        String code = lastCodeEvent().code();

        reset(EMAIL, code, NEW_PASSWORD)
                .andExpect(status().isNoContent())
                // Cookie cancellato: stesso nome e Path, Max-Age=0.
                .andExpect(header().string("Set-Cookie", containsString("resonance_refresh=;")))
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")))
                .andExpect(header().string("Set-Cookie", containsString("Path=/api/auth/refresh")))
                // Il reset non effettua il login: nessun token nel body.
                .andExpect(content().string(""));

        User user = users.findByEmail(EMAIL).orElseThrow();
        assertThat(passwordEncoder.matches(NEW_PASSWORD, user.getPasswordHash())).isTrue();
        assertThat(codes.findByUserIdAndPurpose(user.getId(), EmailCodePurpose.PASSWORD_RESET).orElseThrow()
                .getCode()).isNull();
        assertThat(events.stream(PasswordChangedEmailEvent.class).toList())
                .singleElement().satisfies(event -> assertThat(event.recipient()).isEqualTo(EMAIL));
    }

    @Test
    void reset_thenLoginWorksWithTheNewPasswordOnly() throws Exception {
        verifiedUser(EMAIL);
        forgot(EMAIL).andExpect(status().isNoContent());
        reset(EMAIL, lastCodeEvent().code(), NEW_PASSWORD).andExpect(status().isNoContent());

        login(EMAIL, NEW_PASSWORD).andExpect(status().isOk());
        login(EMAIL, OLD_PASSWORD)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void reset_revokesEveryRefreshTokenOfTheUser() throws Exception {
        verifiedUser(EMAIL);
        // Due dispositivi con una sessione aperta ciascuno.
        String firstDevice = refreshCookieOf(login(EMAIL, OLD_PASSWORD).andReturn());
        String secondDevice = refreshCookieOf(login(EMAIL, OLD_PASSWORD).andReturn());
        forgot(EMAIL).andExpect(status().isNoContent());

        reset(EMAIL, lastCodeEvent().code(), NEW_PASSWORD).andExpect(status().isNoContent());

        assertThat(refreshTokens.findAll()).hasSize(2).allMatch(RefreshToken::isRevoked);
        // Il vecchio refresh non apre piu' nessuna sessione (revocato senza replaced_by: riuso, 401).
        refresh(firstDevice)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_REUSED"));
        refresh(secondDevice).andExpect(status().isUnauthorized());
    }

    @Test
    void reset_withAWrongCode_returns400AndTheConsumedAttemptIsKept() throws Exception {
        User user = verifiedUser(EMAIL);
        forgot(EMAIL).andExpect(status().isNoContent());
        String wrong = otherThan(lastCodeEvent().code());

        reset(EMAIL, wrong, NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CODE_INVALID"));

        // Il tentativo e' salvato anche se la risposta e' un errore: senza noRollbackFor il limite si aggirerebbe.
        assertThat(codes.findByUserIdAndPurpose(user.getId(), EmailCodePurpose.PASSWORD_RESET).orElseThrow()
                .getAttempts()).isEqualTo(1);
        // Password e sessioni non cambiano.
        assertThat(passwordEncoder.matches(OLD_PASSWORD, users.findByEmail(EMAIL).orElseThrow().getPasswordHash()))
                .isTrue();
        assertThat(events.stream(PasswordChangedEmailEvent.class)).isEmpty();
    }

    @Test
    void reset_afterFiveWrongCodes_theRightOneIsStillCodeInvalid() throws Exception {
        verifiedUser(EMAIL);
        forgot(EMAIL).andExpect(status().isNoContent());
        String right = lastCodeEvent().code();
        for (int i = 0; i < 5; i++) {
            reset(EMAIL, otherThan(right), NEW_PASSWORD)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("CODE_INVALID"));
        }

        // Tentativi esauriti: per il reset e' comunque CODE_INVALID, mai CODE_EXPIRED (decisione 51).
        reset(EMAIL, right, NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CODE_INVALID"));

        assertThat(passwordEncoder.matches(OLD_PASSWORD, users.findByEmail(EMAIL).orElseThrow().getPasswordHash()))
                .isTrue();
    }

    @Test
    void reset_afterFifteenMinutes_returnsCodeInvalid() throws Exception {
        verifiedUser(EMAIL);
        forgot(EMAIL).andExpect(status().isNoContent());
        String code = lastCodeEvent().code();
        clock.advance(Duration.ofMinutes(15).plusSeconds(1));

        reset(EMAIL, code, NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CODE_INVALID"));
    }

    @Test
    void reset_theSameCodeTwice_theSecondIsCodeInvalid() throws Exception {
        verifiedUser(EMAIL);
        forgot(EMAIL).andExpect(status().isNoContent());
        String code = lastCodeEvent().code();
        reset(EMAIL, code, NEW_PASSWORD).andExpect(status().isNoContent());

        reset(EMAIL, code, "altra-password-2")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CODE_INVALID"));

        assertThat(passwordEncoder.matches(NEW_PASSWORD, users.findByEmail(EMAIL).orElseThrow().getPasswordHash()))
                .isTrue();
    }

    @Test
    void reset_forAnUnknownEmail_returns400CodeInvalid() throws Exception {
        reset("sconosciuto@example.com", "123456", NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CODE_INVALID"));
    }

    @Test
    void reset_forAnUnverifiedUser_returns400CodeInvalid() throws Exception {
        // Stessa risposta di un'email sconosciuta: non rivela che l'account esiste.
        users.save(new User(EMAIL, passwordEncoder.encode(OLD_PASSWORD), "Mario"));

        reset(EMAIL, "123456", NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CODE_INVALID"));
    }

    @Test
    void reset_forASuspendedUserWithTheRightCode_returns403AndDoesNotChangeThePassword() throws Exception {
        User user = verifiedUser(EMAIL);
        forgot(EMAIL).andExpect(status().isNoContent());
        String code = lastCodeEvent().code();
        suspend(user);

        // ACCOUNT_SUSPENDED solo con il codice valido: chi lo ha, possiede la casella (decisione 51).
        reset(EMAIL, code, NEW_PASSWORD)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"));

        assertThat(passwordEncoder.matches(OLD_PASSWORD, users.findByEmail(EMAIL).orElseThrow().getPasswordHash()))
                .isTrue();
        assertThat(events.stream(PasswordChangedEmailEvent.class)).isEmpty();
    }

    @Test
    void reset_forASuspendedUserWithAWrongCode_returns400CodeInvalidLikeAnyoneElse() throws Exception {
        User user = verifiedUser(EMAIL);
        forgot(EMAIL).andExpect(status().isNoContent());
        String wrong = otherThan(lastCodeEvent().code());
        suspend(user);

        // Senza il codice giusto non si scopre che l'account e' sospeso.
        reset(EMAIL, wrong, NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CODE_INVALID"))
                .andExpect(jsonPath("$.details").isEmpty());
    }

    @Test
    void reset_forASuspendedUserWithoutAnyCode_returns400CodeInvalid() throws Exception {
        suspend(verifiedUser(EMAIL));

        reset(EMAIL, "123456", NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CODE_INVALID"));
    }

    @Test
    void reset_forAVerifiedUserWithoutAnyCode_returns400CodeInvalid() throws Exception {
        verifiedUser(EMAIL);

        // Nessun forgot prima: codice assente, stessa risposta di un codice sbagliato.
        reset(EMAIL, "123456", NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CODE_INVALID"));
    }

    // Ripetuto 10 volte: la corsa fra le due richieste dipende dai tempi, una sola esecuzione non basta.
    @RepeatedTest(10)
    void reset_twoParallelRequestsWithTheSameValidCode_onlyOneSucceeds() throws Exception {
        verifiedUser(EMAIL);
        forgot(EMAIL).andExpect(status().isNoContent());
        String code = lastCodeEvent().code();

        // Il lock sulla riga dell'utente serializza i due reset: il secondo trova il codice gia' usato.
        CyclicBarrier startTogether = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<MvcResult>> results = new ArrayList<>();
            for (String newPassword : List.of("password-uno-1", "password-due-2")) {
                results.add(pool.submit(() -> {
                    startTogether.await(10, TimeUnit.SECONDS);
                    return reset(EMAIL, code, newPassword).andReturn();
                }));
            }
            List<MvcResult> responses = new ArrayList<>();
            for (Future<MvcResult> result : results) {
                responses.add(result.get(30, TimeUnit.SECONDS));
            }

            assertThat(responses).extracting(r -> r.getResponse().getStatus()).containsExactlyInAnyOrder(204, 400);
            MvcResult rejected = responses.stream().filter(r -> r.getResponse().getStatus() == 400).findFirst()
                    .orElseThrow();
            assertThat(rejected.getResponse().getContentAsString()).contains("CODE_INVALID");
            // Una sola email di avviso, e la password e' quella della richiesta riuscita.
            assertThat(events.stream(PasswordChangedEmailEvent.class)).hasSize(1);
            MvcResult winner = responses.stream().filter(r -> r.getResponse().getStatus() == 204).findFirst()
                    .orElseThrow();
            String winnerPassword = responses.indexOf(winner) == 0 ? "password-uno-1" : "password-due-2";
            assertThat(passwordEncoder.matches(winnerPassword,
                    users.findByEmail(EMAIL).orElseThrow().getPasswordHash())).isTrue();
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void reset_normalizesTheEmail() throws Exception {
        verifiedUser(EMAIL);
        forgot(EMAIL).andExpect(status().isNoContent());

        reset("  Mario@Example.COM ", lastCodeEvent().code(), NEW_PASSWORD).andExpect(status().isNoContent());

        assertThat(passwordEncoder.matches(NEW_PASSWORD, users.findByEmail(EMAIL).orElseThrow().getPasswordHash()))
                .isTrue();
    }

    @Test
    void reset_withAMultibytePasswordOver72Bytes_returns400OnTheNewPasswordField() throws Exception {
        verifiedUser(EMAIL);
        forgot(EMAIL).andExpect(status().isNoContent());
        String code = lastCodeEvent().code();

        // 40 "è": 40 caratteri (sotto il massimo di 72) ma 80 byte in UTF-8, coerente con la registrazione.
        reset(EMAIL, code, "è".repeat(40))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.newPassword").exists());

        // La validazione precede il service: il codice non e' stato consumato.
        reset(EMAIL, code, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    @Test
    void reset_withEmojiInTheNewPassword_returns400OnTheNewPasswordField() throws Exception {
        verifiedUser(EMAIL);
        forgot(EMAIL).andExpect(status().isNoContent());
        String code = lastCodeEvent().code();

        // Sotto i 72 byte e con una cifra: a fermarla e' solo la regola sulle emoji (decisione 84).
        reset(EMAIL, code, "nuova1-🎸-password")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.newPassword").value("non può contenere emoji"))
                .andExpect(content().string(not(containsString("nuova1-🎸-password"))));

        // La validazione precede il service: il codice non e' stato consumato e la password e' invariata.
        reset(EMAIL, code, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    // ------------------------------------------ password lettera+numero (decisione 113)

    @Test
    void reset_withOnlyLettersInTheNewPassword_returns400OnTheNewPasswordField() throws Exception {
        verifiedUser(EMAIL);
        forgot(EMAIL).andExpect(status().isNoContent());
        String code = lastCodeEvent().code();

        reset(EMAIL, code, "solo-lettere-niente-cifre")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.newPassword").value("deve contenere almeno una lettera e un numero"));

        // La validazione precede il service: il codice non e' stato consumato.
        reset(EMAIL, code, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    @Test
    void reset_withAShortPasswordOrBadCode_returns400WithTheFieldsAndDoesNotEchoThePassword() throws Exception {
        reset(EMAIL, "12ab56", "corta")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.code").exists())
                .andExpect(jsonPath("$.fields.newPassword").exists())
                .andExpect(content().string(not(containsString("corta"))));
    }

    // ---------------------------------------------------------------- helper

    private ResultActions forgot(String email) throws Exception {
        return mockMvc.perform(post("/api/auth/password/forgot").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("email", email))));
    }

    private ResultActions reset(String email, String code, String newPassword) throws Exception {
        return mockMvc.perform(post("/api/auth/password/reset").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("email", email, "code", code, "newPassword", newPassword))));
    }

    private ResultActions login(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("email", email, "password", password))));
    }

    private ResultActions refresh(String cookieValue) throws Exception {
        return mockMvc.perform(post("/api/auth/refresh").header("X-Requested-With", "XMLHttpRequest")
                .cookie(new Cookie("resonance_refresh", cookieValue)));
    }

    private static String refreshCookieOf(MvcResult login) {
        Cookie cookie = login.getResponse().getCookie("resonance_refresh");
        if (cookie != null) {
            return cookie.getValue();
        }
        // MockMvc a volte lascia il cookie solo nell'header Set-Cookie.
        String header = login.getResponse().getHeader("Set-Cookie");
        assertThat(header).isNotNull();
        return header.substring(header.indexOf('=') + 1, header.indexOf(';'));
    }

    private String body(Map<String, String> fields) {
        return json.writeValueAsString(fields);
    }

    private PasswordResetCodeEmailEvent lastCodeEvent() {
        List<PasswordResetCodeEmailEvent> sent = events.stream(PasswordResetCodeEmailEvent.class).toList();
        assertThat(sent).isNotEmpty();
        return sent.get(sent.size() - 1);
    }

    private static String otherThan(String code) {
        return "000000".equals(code) ? "111111" : "000000";
    }

    /** Utente verificato, ACTIVE, con il ruolo FAN, salvato nel database. */
    private User verifiedUser(String email) {
        User created = new User(email, passwordEncoder.encode(OLD_PASSWORD), "Mario");
        created.setEmailVerified(true);
        User saved = users.save(created);
        roles.save(new UserRole(saved.getId(), Role.FAN));
        return saved;
    }

    private void suspend(User user) {
        User moderator = users.save(new User("admin-" + UUID.randomUUID() + "@example.com", "hash-di-prova", "Admin"));
        user.setStatus(UserStatus.SUSPENDED);
        user.setSuspendedAt(clock.instant());
        user.setSuspendedBy(moderator.getId());
        user.setSuspensionReason("Linguaggio offensivo");
        users.save(user);
    }
}

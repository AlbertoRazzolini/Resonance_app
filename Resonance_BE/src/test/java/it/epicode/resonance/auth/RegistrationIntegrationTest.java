package it.epicode.resonance.auth;

import it.epicode.resonance.mail.VerificationCodeEmailEvent;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
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
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.ArrayList;
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
 * Registrazione, verifica dell'email e reinvio del codice via HTTP, con la vera catena di sicurezza
 * (progettazione, sezioni 4.4-4.6). Il codice si legge dall'evento email pubblicato, come farebbe il listener.
 */
@RecordApplicationEvents
class RegistrationIntegrationTest extends IntegrationTest {

    private static final String EMAIL = "mario@example.com";
    private static final String PASSWORD = "password-corretta";

    @Autowired
    private ApplicationEvents events;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private EmailCodeRepository codes;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JsonMapper json;

    // ------------------------------------------------------------- register

    @Test
    void register_createsUnverifiedFanAndPublishesTheVerificationCode() throws Exception {
        register(EMAIL, PASSWORD, "Mario")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(EMAIL))
                // Nessun id utente nella risposta: al client non serve (decisione 49).
                .andExpect(jsonPath("$.id").doesNotExist());

        User user = users.findByEmail(EMAIL).orElseThrow();
        assertThat(user.isEmailVerified()).isFalse();
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(user.getDisplayName()).isEqualTo("Mario");
        assertThat(passwordEncoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
        assertThat(roles.findRolesByUserId(user.getId())).containsExactly(Role.FAN);
        VerificationCodeEmailEvent event = lastEvent();
        assertThat(event.recipient()).isEqualTo(EMAIL);
        assertThat(event.displayName()).isEqualTo("Mario");
        assertThat(event.code()).matches("\\d{6}");
        assertThat(codes.findByUserIdAndPurpose(user.getId(), EmailCodePurpose.EMAIL_VERIFICATION).orElseThrow()
                .getCode()).isEqualTo(event.code());
    }

    @Test
    void register_normalizesEmail() throws Exception {
        register("  Mario@Example.COM ", PASSWORD, "Mario")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(EMAIL));

        assertThat(users.findByEmail(EMAIL)).isPresent();
        assertThat(users.count()).isEqualTo(1);
        assertThat(lastEvent().recipient()).isEqualTo(EMAIL);
    }

    @Test
    void register_withMultibytePasswordOver72Bytes_returns400OnThePasswordField() throws Exception {
        // 40 "è": 40 caratteri (sotto il massimo di 72) ma 80 byte in UTF-8 (review focus 2). Non emoji, come dopo la
        // decisione 84: il test prova il limite dei byte e non la regola sulle emoji.
        register(EMAIL, "è".repeat(40), "Mario")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.password").exists());

        assertThat(users.count()).isZero();
        assertThat(events.stream(VerificationCodeEmailEvent.class)).isEmpty();
    }

    // ------------------------------------------------- nome e password (decisione 84)

    @Test
    void register_withEmojiInThePassword_returns400OnThePasswordField() throws Exception {
        // Sotto i 72 byte: a fermarla e' la regola sulle emoji, non quella dei byte.
        register(EMAIL, "password-🎸-lunga", "Mario")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.password").value("non può contenere emoji"))
                .andExpect(content().string(not(containsString("password-🎸-lunga"))));

        assertThat(users.count()).isZero();
        assertThat(events.stream(VerificationCodeEmailEvent.class)).isEmpty();
    }

    @Test
    void register_withEmojiInTheName_returns400OnTheDisplayNameField() throws Exception {
        register(EMAIL, PASSWORD, "Mario 🎸")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.displayName").value("non può contenere emoji"));

        assertThat(users.count()).isZero();
    }

    @Test
    void register_withAnInvisibleCharacterInTheName_returns400OnTheDisplayNameField() throws Exception {
        // Spazio a larghezza zero e inversione del testo: nomi uguali a vista ma diversi.
        register(EMAIL, PASSWORD, "Mario\u200BRossi")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.displayName").value("non può contenere caratteri invisibili"));
        register(EMAIL, PASSWORD, "Mario\u202Eoiram")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.displayName").exists());

        assertThat(users.count()).isZero();
    }

    @Test
    void register_withANameOf3Characters_isAccepted_andOf2Characters_isRejected() throws Exception {
        // Minimo 3 (decisione 84): blocca i nomi da due lettere scritti a caso, senza escludere "Mia" o "Ugo".
        register(EMAIL, PASSWORD, "AB")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.displayName").exists());
        assertThat(users.count()).isZero();

        register(EMAIL, PASSWORD, "Mia").andExpect(status().isCreated());
        assertThat(users.findByEmail(EMAIL).orElseThrow().getDisplayName()).isEqualTo("Mia");
    }

    @Test
    void register_withANameOf30Characters_isAccepted_andOf31Characters_isRejected() throws Exception {
        register(EMAIL, PASSWORD, "x".repeat(30)).andExpect(status().isCreated());
        assertThat(users.findByEmail(EMAIL).orElseThrow().getDisplayName()).isEqualTo("x".repeat(30));

        register("altro@example.com", PASSWORD, "x".repeat(31))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.displayName").exists());
        assertThat(users.findByEmail("altro@example.com")).isEmpty();
    }

    @Test
    void register_withAccentedNameAndPassword_isAccepted() throws Exception {
        register(EMAIL, "pässwörd-sicüra", "Zoë Società Già-Là!").andExpect(status().isCreated());

        assertThat(users.findByEmail(EMAIL).orElseThrow().getDisplayName()).isEqualTo("Zoë Società Già-Là!");
    }

    @Test
    void register_withInvalidFields_returns400WithTheFieldsAndDoesNotEchoThePassword() throws Exception {
        register("non-una-email", "corta", "M")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.email").exists())
                .andExpect(jsonPath("$.fields.password").exists())
                .andExpect(jsonPath("$.fields.displayName").exists())
                .andExpect(content().string(not(containsString("corta"))));
    }

    @Test
    void register_withAVerifiedEmail_returns409() throws Exception {
        users.save(verifiedUser(EMAIL));

        register(EMAIL, PASSWORD, "Altro")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_REGISTERED"));

        assertThat(users.findByEmail(EMAIL).orElseThrow().getDisplayName()).isEqualTo("Mario");
        assertThat(events.stream(VerificationCodeEmailEvent.class)).isEmpty();
    }

    @Test
    void register_withASuspendedEmail_returns409() throws Exception {
        User suspended = users.save(new User(EMAIL, passwordEncoder.encode(PASSWORD), "Mario"));
        User moderator = users.save(new User("admin@example.com", "hash-di-prova", "Admin"));
        suspended.setStatus(UserStatus.SUSPENDED);
        suspended.setSuspendedAt(clock.instant());
        suspended.setSuspendedBy(moderator.getId());
        suspended.setSuspensionReason("Linguaggio offensivo");
        users.save(suspended);

        register(EMAIL, PASSWORD, "Mario")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_REGISTERED"));
    }

    @Test
    void register_againForAnUnverifiedEmail_overwritesNameAndPasswordAndSendsANewCode() throws Exception {
        register(EMAIL, PASSWORD, "Mario").andExpect(status().isCreated());
        clock.advance(Duration.ofSeconds(61));

        register(EMAIL, "nuova-password-1", "Mario Rossi").andExpect(status().isCreated());

        User user = users.findByEmail(EMAIL).orElseThrow();
        assertThat(user.getDisplayName()).isEqualTo("Mario Rossi");
        assertThat(passwordEncoder.matches("nuova-password-1", user.getPasswordHash())).isTrue();
        assertThat(users.count()).isEqualTo(1);
        assertThat(roles.findRolesByUserId(user.getId())).containsExactly(Role.FAN);
        assertThat(events.stream(VerificationCodeEmailEvent.class).toList()).hasSize(2);
        assertThat(codes.count()).isEqualTo(1);
    }

    @Test
    void register_againWithinSixtySeconds_returns429AndKeepsTheOldData() throws Exception {
        register(EMAIL, PASSWORD, "Mario").andExpect(status().isCreated());

        register(EMAIL, "nuova-password-1", "Mario Rossi")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));

        // La richiesta respinta non deve aver sovrascritto niente.
        User user = users.findByEmail(EMAIL).orElseThrow();
        assertThat(user.getDisplayName()).isEqualTo("Mario");
        assertThat(passwordEncoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
        assertThat(events.stream(VerificationCodeEmailEvent.class).toList()).hasSize(1);
    }

    // Ripetuto 10 volte: la corsa fra le due richieste dipende dai tempi, una sola esecuzione non basta.
    @RepeatedTest(10)
    void register_twoParallelRequestsForTheSameNewEmail_oneCreatesAndTheOtherGets409Never500() throws Exception {
        // Nessuna riga da bloccare: entrambe vedono l'email libera e inseriscono; la seconda urta uq_users_email,
        // che GlobalExceptionHandler traduce in 409 EMAIL_ALREADY_REGISTERED (progettazione, sezione 4.4, passo 6).
        CyclicBarrier startTogether = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<MvcResult>> results = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                results.add(pool.submit(() -> {
                    startTogether.await(10, TimeUnit.SECONDS);
                    return register(EMAIL, PASSWORD, "Mario").andReturn();
                }));
            }
            List<MvcResult> responses = new ArrayList<>();
            for (Future<MvcResult> result : results) {
                responses.add(result.get(30, TimeUnit.SECONDS));
            }

            assertThat(responses).extracting(r -> r.getResponse().getStatus()).containsExactlyInAnyOrder(201, 409);
            MvcResult conflict = responses.stream().filter(r -> r.getResponse().getStatus() == 409).findFirst()
                    .orElseThrow();
            assertThat(conflict.getResponse().getContentAsString()).contains("EMAIL_ALREADY_REGISTERED");
            assertThat(users.count()).isEqualTo(1);
            assertThat(codes.count()).isEqualTo(1);
            assertThat(events.stream(VerificationCodeEmailEvent.class)).hasSize(1);
        } finally {
            pool.shutdownNow();
        }
    }

    // --------------------------------------------------------------- verify

    @Test
    void verify_withTheRightCodeAndPassword_verifiesTheEmailAndOpensTheSession() throws Exception {
        register(EMAIL, PASSWORD, "Mario").andExpect(status().isCreated());

        verify(EMAIL, lastEvent().code(), PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value(EMAIL))
                .andExpect(jsonPath("$.user.roles[0]").value("FAN"))
                .andExpect(header().string("Set-Cookie", containsString("resonance_refresh=")))
                .andExpect(header().string("Set-Cookie", containsString("HttpOnly")));

        User user = users.findByEmail(EMAIL).orElseThrow();
        assertThat(user.isEmailVerified()).isTrue();
        assertThat(codes.findByUserIdAndPurpose(user.getId(), EmailCodePurpose.EMAIL_VERIFICATION).orElseThrow()
                .getCode()).isNull();
        // Ora il login funziona.
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("email", EMAIL, "password", PASSWORD))))
                .andExpect(status().isOk());
    }

    @Test
    void verify_withAWrongCode_returns400AndTheConsumedAttemptIsKept() throws Exception {
        register(EMAIL, PASSWORD, "Mario").andExpect(status().isCreated());
        String wrong = otherThan(lastEvent().code());

        verify(EMAIL, wrong, PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CODE_INVALID"));

        // Il tentativo e' salvato anche se la risposta e' un errore: senza noRollbackFor il limite si aggirerebbe.
        UUID userId = users.findByEmail(EMAIL).orElseThrow().getId();
        assertThat(codes.findByUserIdAndPurpose(userId, EmailCodePurpose.EMAIL_VERIFICATION).orElseThrow()
                .getAttempts()).isEqualTo(1);
        assertThat(users.findByEmail(EMAIL).orElseThrow().isEmailVerified()).isFalse();
    }

    @Test
    void verify_afterFiveWrongCodes_theRightOneIsExpired() throws Exception {
        register(EMAIL, PASSWORD, "Mario").andExpect(status().isCreated());
        String right = lastEvent().code();
        for (int i = 0; i < 5; i++) {
            verify(EMAIL, otherThan(right), PASSWORD)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("CODE_INVALID"));
        }

        verify(EMAIL, right, PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CODE_EXPIRED"));

        assertThat(users.findByEmail(EMAIL).orElseThrow().isEmailVerified()).isFalse();
    }

    @Test
    void verify_afterFifteenMinutes_returnsCodeExpired() throws Exception {
        register(EMAIL, PASSWORD, "Mario").andExpect(status().isCreated());
        String code = lastEvent().code();
        clock.advance(Duration.ofMinutes(15).plusSeconds(1));

        verify(EMAIL, code, PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CODE_EXPIRED"));
    }

    @Test
    void verify_withADifferentPassword_returns400WrongPasswordAndKeepsTheCodeUsable() throws Exception {
        register(EMAIL, PASSWORD, "Mario").andExpect(status().isCreated());
        String code = lastEvent().code();

        verify(EMAIL, code, "un-altra-password")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("WRONG_PASSWORD"));

        assertThat(users.findByEmail(EMAIL).orElseThrow().isEmailVerified()).isFalse();
        verify(EMAIL, code, PASSWORD).andExpect(status().isOk());
    }

    @Test
    void verify_withAPasswordOver72Bytes_isTreatedAsAWrongPassword() throws Exception {
        register(EMAIL, PASSWORD, "Mario").andExpect(status().isCreated());

        verify(EMAIL, lastEvent().code(), "😀".repeat(30))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("WRONG_PASSWORD"));
    }

    @Test
    void verify_forAnAlreadyVerifiedEmail_returns409() throws Exception {
        users.save(verifiedUser(EMAIL));

        verify(EMAIL, "123456", PASSWORD)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ALREADY_VERIFIED"));
    }

    @Test
    void verify_forAnUnknownEmail_returns400CodeInvalid() throws Exception {
        verify("sconosciuto@example.com", "123456", PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CODE_INVALID"));
    }

    @Test
    void verify_forASuspendedAccount_returns403WithTheDetails() throws Exception {
        register(EMAIL, PASSWORD, "Mario").andExpect(status().isCreated());
        String code = lastEvent().code();
        User user = users.findByEmail(EMAIL).orElseThrow();
        User moderator = users.save(new User("admin@example.com", "hash-di-prova", "Admin"));
        user.setStatus(UserStatus.SUSPENDED);
        user.setSuspendedAt(clock.instant());
        user.setSuspendedBy(moderator.getId());
        user.setSuspensionReason("Linguaggio offensivo");
        users.save(user);

        verify(EMAIL, code, PASSWORD)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"))
                .andExpect(jsonPath("$.details.suspensionReason").value("Linguaggio offensivo"));

        assertThat(users.findByEmail(EMAIL).orElseThrow().isEmailVerified()).isFalse();
    }

    @Test
    void verify_withACodeThatIsNotSixDigits_returns400OnTheCodeField() throws Exception {
        verify(EMAIL, "12ab56", PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.code").exists());
    }

    // ----------------------------------------------------------- resend-code

    @Test
    void resendCode_forAnUnverifiedAccount_returns204AndReplacesTheCode() throws Exception {
        register(EMAIL, PASSWORD, "Mario").andExpect(status().isCreated());
        clock.advance(Duration.ofSeconds(61));

        resend(EMAIL).andExpect(status().isNoContent());

        List<VerificationCodeEmailEvent> sent = events.stream(VerificationCodeEmailEvent.class).toList();
        assertThat(sent).hasSize(2);
        UUID userId = users.findByEmail(EMAIL).orElseThrow().getId();
        assertThat(codes.findByUserIdAndPurpose(userId, EmailCodePurpose.EMAIL_VERIFICATION).orElseThrow()
                .getCode()).isEqualTo(sent.get(1).code());
    }

    @Test
    void resendCode_forAnUnknownEmail_returns204WithoutSendingAnything() throws Exception {
        resend("sconosciuto@example.com").andExpect(status().isNoContent());

        assertThat(events.stream(VerificationCodeEmailEvent.class)).isEmpty();
    }

    @Test
    void resendCode_forAVerifiedAccount_returns204WithoutSendingAnything() throws Exception {
        users.save(verifiedUser(EMAIL));

        resend(EMAIL).andExpect(status().isNoContent());

        assertThat(events.stream(VerificationCodeEmailEvent.class)).isEmpty();
    }

    @Test
    void resendCode_withinSixtySeconds_returns429() throws Exception {
        register(EMAIL, PASSWORD, "Mario").andExpect(status().isCreated());

        resend(EMAIL)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));
    }

    @Test
    void resendCode_withoutEmail_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/resend-code").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.email").exists());
    }

    // ---------------------------------------------------------------- helper

    private ResultActions register(String email, String password, String displayName) throws Exception {
        return mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("email", email, "password", password, "displayName", displayName))));
    }

    private ResultActions verify(String email, String code, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/verify").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("email", email, "code", code, "password", password))));
    }

    private ResultActions resend(String email) throws Exception {
        return mockMvc.perform(post("/api/auth/resend-code").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("email", email))));
    }

    private String body(Map<String, String> fields) {
        return json.writeValueAsString(fields);
    }

    private VerificationCodeEmailEvent lastEvent() {
        List<VerificationCodeEmailEvent> sent = events.stream(VerificationCodeEmailEvent.class).toList();
        assertThat(sent).isNotEmpty();
        return sent.get(sent.size() - 1);
    }

    private static String otherThan(String code) {
        return "000000".equals(code) ? "111111" : "000000";
    }

    private User verifiedUser(String email) {
        User created = new User(email, passwordEncoder.encode(PASSWORD), "Mario");
        created.setEmailVerified(true);
        return created;
    }
}

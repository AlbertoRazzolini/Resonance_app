package it.epicode.resonance.admin;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.auth.RefreshTokenRepository;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sospensione e riattivazione degli utenti via HTTP, con la vera catena di sicurezza (progettazione, sezioni 5.5 e
 * 5.6): durata o data, riattivazione pigra e manuale, revoca dei token, regola dei livelli.
 */
@RecordApplicationEvents
class SuspensionIntegrationTest extends IntegrationTest {

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

    @Autowired
    private ApplicationEvents events;

    // ---------------------------------------------------------------- sospensione

    @Test
    void suspend_withDuration_blocksLoginWithReasonAndExpiry() throws Exception {
        User admin = userWith(Role.ADMIN);
        User target = userWith();

        suspend(admin, target, "{\"reason\":\"Linguaggio offensivo\",\"durationDays\":3}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(target.getId().toString()))
                .andExpect(jsonPath("$.status").value("SUSPENDED"))
                .andExpect(jsonPath("$.suspensionReason").value("Linguaggio offensivo"))
                .andExpect(jsonPath("$.suspendedBy").value(admin.getId().toString()))
                .andExpect(jsonPath("$.suspendedAt").isNotEmpty())
                .andExpect(jsonPath("$.suspendedUntil").isNotEmpty())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        User saved = users.findById(target.getId()).orElseThrow();
        assertThat(saved.getSuspendedUntil()).isCloseTo(clock.instant().plus(Duration.ofDays(3)),
                org.assertj.core.api.Assertions.within(2, ChronoUnit.SECONDS));

        login(target.getEmail())
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"))
                .andExpect(jsonPath("$.details.suspensionReason").value("Linguaggio offensivo"))
                .andExpect(jsonPath("$.details.suspendedUntil").isNotEmpty());
    }

    @Test
    void suspend_withUntilDate_storesThatInstant() throws Exception {
        User admin = userWith(Role.ADMIN);
        User target = userWith();
        Instant until = clock.instant().plus(Duration.ofDays(10)).truncatedTo(ChronoUnit.SECONDS);

        suspend(admin, target, "{\"reason\":\"Spam\",\"suspendedUntil\":\"" + until + "\"}")
                .andExpect(status().isOk());

        assertThat(users.findById(target.getId()).orElseThrow().getSuspendedUntil()).isEqualTo(until);
    }

    @Test
    void suspend_withoutLimit_isIndefinite_andStaysAfterALongTime() throws Exception {
        User admin = userWith(Role.ADMIN);
        User target = userWith();

        suspend(admin, target, "{\"reason\":\"Account usato per truffe\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suspendedUntil").value(nullValue()));

        clock.advance(Duration.ofDays(400));
        login(target.getEmail())
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"));
    }

    @Test
    void suspend_revokesAllRefreshTokens_andRefreshFails() throws Exception {
        User admin = userWith(Role.ADMIN);
        User target = userWith();
        String refreshCookie = login(target.getEmail()).andExpect(status().isOk())
                .andReturn().getResponse().getCookie(COOKIE).getValue();

        suspend(admin, target, "{\"reason\":\"Spam\",\"durationDays\":7}").andExpect(status().isOk());

        assertThat(refreshTokens.findAll()).isNotEmpty().allMatch(token -> token.isRevoked());
        // Il token e' stato revocato dalla sospensione, senza essere ruotato: il refresh non rilascia nulla.
        mockMvc.perform(post("/api/auth/refresh").cookie(new Cookie(COOKIE, refreshCookie))
                        .header("X-Requested-With", "XMLHttpRequest"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void suspend_alreadyIssuedAccessToken_returns401OnTheNextRequest() throws Exception {
        User admin = userWith(Role.ADMIN);
        User target = userWith();
        String token = bearer(target);
        mockMvc.perform(get("/api/users/me").header("Authorization", token)).andExpect(status().isOk());

        suspend(admin, target, "{\"reason\":\"Spam\"}").andExpect(status().isOk());

        // Lo stato si legge dal database a ogni richiesta (sezione 5.2): il token non scade, ma non basta piu'.
        mockMvc.perform(get("/api/users/me").header("Authorization", token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void suspend_publishesTheEvent() throws Exception {
        User admin = userWith(Role.ADMIN);
        User target = userWith();

        suspend(admin, target, "{\"reason\":\"Spam\"}").andExpect(status().isOk());

        assertThat(events.stream(UserSuspendedEvent.class))
                .extracting(UserSuspendedEvent::userId).containsExactly(target.getId());
    }

    @Test
    void suspend_withDurationOfOneDay_isLazilyReactivatedAfter25Hours() throws Exception {
        User admin = userWith(Role.ADMIN);
        User target = userWith();
        suspend(admin, target, "{\"reason\":\"Spam\",\"durationDays\":1}").andExpect(status().isOk());
        login(target.getEmail()).andExpect(status().isForbidden());

        clock.advance(Duration.ofHours(25));

        // Nessun job: e' il login a trovare la sospensione scaduta e a chiuderla (sezione 5.5).
        login(target.getEmail()).andExpect(status().isOk());
        User saved = users.findById(target.getId()).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(saved.getSuspendedAt()).isNull();
        assertThat(saved.getSuspendedBy()).isNull();
        assertThat(saved.getSuspensionReason()).isNull();
        assertThat(saved.getSuspendedUntil()).isNull();
    }

    @Test
    void suspend_alreadySuspended_updatesTheDetails() throws Exception {
        User admin = userWith(Role.ADMIN);
        User target = userWith();
        suspend(admin, target, "{\"reason\":\"Primo avviso\",\"durationDays\":1}").andExpect(status().isOk());

        suspend(admin, target, "{\"reason\":\"Recidivo\",\"durationDays\":30}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suspensionReason").value("Recidivo"));

        User saved = users.findById(target.getId()).orElseThrow();
        assertThat(saved.getSuspensionReason()).isEqualTo("Recidivo");
        assertThat(saved.getSuspendedUntil()).isAfter(clock.instant().plus(Duration.ofDays(29)));
    }

    // ---------------------------------------------------------------- validazione

    @Test
    void suspend_withBothUntilAndDuration_returns400OnBothFields() throws Exception {
        User admin = userWith(Role.ADMIN);
        User target = userWith();
        String until = clock.instant().plus(Duration.ofDays(5)).toString();

        suspend(admin, target, "{\"reason\":\"Spam\",\"durationDays\":3,\"suspendedUntil\":\"" + until + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.suspendedUntil").exists())
                .andExpect(jsonPath("$.fields.durationDays").exists());

        assertThat(users.findById(target.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Test
    void suspend_withInvalidFields_returns400() throws Exception {
        User admin = userWith(Role.ADMIN);
        User target = userWith();
        String past = clock.instant().minus(Duration.ofDays(1)).toString();

        suspend(admin, target, "{\"durationDays\":3}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.reason").exists());
        suspend(admin, target, "{\"reason\":\"   \"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.reason").exists());
        suspend(admin, target, "{\"reason\":\"" + "x".repeat(501) + "\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.reason").exists());
        suspend(admin, target, "{\"reason\":\"Spam\",\"durationDays\":0}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.durationDays").exists());
        suspend(admin, target, "{\"reason\":\"Spam\",\"durationDays\":3651}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.durationDays").exists());
        suspend(admin, target, "{\"reason\":\"Spam\",\"suspendedUntil\":\"" + past + "\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.suspendedUntil").exists());
        // Senza fuso orario l'istante e' ambiguo: errore di validazione, non un 500.
        suspend(admin, target, "{\"reason\":\"Spam\",\"suspendedUntil\":\"2099-10-20T21:00\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    // ---------------------------------------------------------------- regola dei livelli

    @Test
    void suspend_adminOnAdmin_returns403_andChangesNothing() throws Exception {
        User admin = userWith(Role.ADMIN);
        User otherAdmin = userWith(Role.ADMIN);

        suspend(admin, otherAdmin, "{\"reason\":\"Spam\"}")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_PLATFORM_LEVEL"));

        assertThat(users.findById(otherAdmin.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(events.stream(UserSuspendedEvent.class)).isEmpty();
    }

    @Test
    void suspend_superadminOnAdmin_isAllowed() throws Exception {
        User superadmin = userWith(Role.SUPERADMIN);
        User admin = userWith(Role.ADMIN);

        suspend(superadmin, admin, "{\"reason\":\"Abuso dei poteri\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUSPENDED"));
    }

    @Test
    void suspend_onSuperadmin_isRejectedForEveryone() throws Exception {
        User superadmin = userWith(Role.SUPERADMIN);
        User otherSuperadmin = userWith(Role.SUPERADMIN);
        User admin = userWith(Role.ADMIN);

        suspend(admin, superadmin, "{\"reason\":\"Spam\"}")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_PLATFORM_LEVEL"));
        suspend(otherSuperadmin, superadmin, "{\"reason\":\"Spam\"}")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_PLATFORM_LEVEL"));
    }

    @Test
    void suspend_oneself_returns403() throws Exception {
        User admin = userWith(Role.ADMIN);

        suspend(admin, admin, "{\"reason\":\"Spam\"}")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_PLATFORM_LEVEL"));
    }

    // ---------------------------------------------------------------- accesso

    @Test
    void suspend_asFan_returns403_andWithoutToken_returns401() throws Exception {
        User fan = userWith();
        User target = userWith();

        suspend(fan, target, "{\"reason\":\"Spam\"}")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        mockMvc.perform(post("/api/admin/users/{id}/suspension", target.getId())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Spam\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/admin/users/{id}/suspension", target.getId()))
                .andExpect(status().isUnauthorized());

        assertThat(users.findById(target.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Test
    void suspend_unknownUser_returns404_andMalformedId_returns400() throws Exception {
        User admin = userWith(Role.ADMIN);

        mockMvc.perform(post("/api/admin/users/{id}/suspension", UUID.randomUUID())
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Spam\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(post("/api/admin/users/non-un-uuid/suspension")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Spam\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    // ---------------------------------------------------------------- riattivazione manuale

    @Test
    void reactivate_manually_allowsLoginAgain() throws Exception {
        User admin = userWith(Role.ADMIN);
        User target = userWith();
        suspend(admin, target, "{\"reason\":\"Spam\"}").andExpect(status().isOk());
        login(target.getEmail()).andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/admin/users/{id}/suspension", target.getId())
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.suspendedAt").value(nullValue()))
                .andExpect(jsonPath("$.suspendedBy").value(nullValue()))
                .andExpect(jsonPath("$.suspensionReason").value(nullValue()))
                .andExpect(jsonPath("$.suspendedUntil").value(nullValue()));

        login(target.getEmail()).andExpect(status().isOk());
    }

    @Test
    void reactivate_isIdempotent_onAnActiveUser() throws Exception {
        User admin = userWith(Role.ADMIN);
        User target = userWith();

        for (int i = 0; i < 2; i++) {
            mockMvc.perform(delete("/api/admin/users/{id}/suspension", target.getId())
                            .header("Authorization", bearer(admin)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("ACTIVE"));
        }
    }

    @Test
    void reactivate_adminOnAdmin_returns403() throws Exception {
        User superadmin = userWith(Role.SUPERADMIN);
        User admin = userWith(Role.ADMIN);
        User otherAdmin = userWith(Role.ADMIN);
        suspend(superadmin, otherAdmin, "{\"reason\":\"Abuso\"}").andExpect(status().isOk());

        mockMvc.perform(delete("/api/admin/users/{id}/suspension", otherAdmin.getId())
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_PLATFORM_LEVEL"));

        assertThat(users.findById(otherAdmin.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.SUSPENDED);
    }

    // ---------------------------------------------------------------- supporto

    private ResultActions suspend(User actor, User target, String body) throws Exception {
        return mockMvc.perform(post("/api/admin/users/{id}/suspension", target.getId())
                .header("Authorization", bearer(actor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private ResultActions login(String email) throws Exception {
        return mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"));
    }

    /**
     * Crea un utente verificato con FAN piu' i ruoli indicati; l'email e' unica per ogni utente perche' il limite
     * dei login falliti e' in memoria e sopravvive fra un test e l'altro.
     */
    private User userWith(Role... extraRoles) {
        User user = new User("utente-" + UUID.randomUUID() + "@example.com", passwordEncoder.encode(PASSWORD), "Utente " + UUID.randomUUID());
        user.setEmailVerified(true);
        users.save(user);
        roles.save(new UserRole(user.getId(), Role.FAN));
        for (Role role : extraRoles) {
            roles.save(new UserRole(user.getId(), role));
        }
        return user;
    }

    private String bearer(User user) {
        return "Bearer " + accessTokens.issue(user.getId()).token();
    }
}

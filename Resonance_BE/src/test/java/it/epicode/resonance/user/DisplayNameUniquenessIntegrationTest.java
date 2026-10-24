package it.epicode.resonance.user;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.mail.VerificationCodeEmailEvent;
import it.epicode.resonance.support.IntegrationTest;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Nome utente unico senza distinguere le maiuscole, in registrazione e nella modifica del profilo, con i nomi
 * riservati e gli spazi ripetuti ridotti a uno (decisione 96, progettazione, sezioni 4.4 e 6.5). Database reale:
 * l'indice unico e' l'ultima difesa contro due richieste insieme.
 */
@RecordApplicationEvents
class DisplayNameUniquenessIntegrationTest extends IntegrationTest {

    private static final String PASSWORD = "password-corretta1";
    private static final String TAKEN_MESSAGE = "Nome già utilizzato";
    private static final String RESERVED_MESSAGE = "Questo nome utente non è disponibile";

    @Autowired
    private ApplicationEvents events;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private AccessTokenService accessTokens;

    @Autowired
    private JsonMapper json;

    // ------------------------------------------------------------ indice

    @Test
    void index_rejectsTheSameNameWithDifferentCase() {
        users.saveAndFlush(new User("a@example.com", "hash-di-prova", "Marco"));

        // Senza passare dal service: e' il database a fermare il doppione (nome del vincolo letto dal gestore errori).
        assertThatThrownBy(() -> users.saveAndFlush(new User("b@example.com", "hash-di-prova", "MARCO")))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("uq_users_display_name_lower");
    }

    // -------------------------------------------------------- registrazione

    @Test
    void register_withANameTakenIgnoringCase_returns409AndCreatesNothing() throws Exception {
        verifiedUser("marco@example.com", "Marco Rossi");

        register("altro@example.com", "marco ROSSI")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DISPLAY_NAME_TAKEN"))
                .andExpect(jsonPath("$.message").value(TAKEN_MESSAGE));

        assertThat(users.count()).isEqualTo(1);
        assertThat(events.stream(VerificationCodeEmailEvent.class)).isEmpty();
    }

    @Test
    void register_withANameHeldByAnUnverifiedAccount_returns409() throws Exception {
        // Decisione 96: il nome e' occupato subito, anche se l'email non e' ancora verificata.
        register("primo@example.com", "Luca88").andExpect(status().isCreated());

        register("secondo@example.com", "luca88")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DISPLAY_NAME_TAKEN"));

        assertThat(users.count()).isEqualTo(1);
    }

    @Test
    void register_withAReservedName_returns400OnTheDisplayNameField() throws Exception {
        for (String name : List.of("Admin", "SUPERADMIN", "resonance", "Staff", "root")) {
            register("riservato@example.com", name)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.fields.displayName").value(RESERVED_MESSAGE));
        }

        assertThat(users.count()).isZero();
        assertThat(events.stream(VerificationCodeEmailEvent.class)).isEmpty();
    }

    @Test
    void register_withAReservedName_isRejectedBeforeTheTakenCheck() throws Exception {
        // L'account superadmin creato all'avvio si chiama "Superadmin": provarlo da' sempre "non disponibile" e mai
        // "gia' preso", cosi' chi prova un nome riservato non scopre se qualcuno lo usa davvero (decisione 96).
        users.saveAndFlush(new User("super@example.com", "hash-di-prova", "Superadmin"));

        register("altro@example.com", "superadmin")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.displayName").value(RESERVED_MESSAGE));
    }

    @Test
    void register_withAdminInsideALongerName_isAccepted() throws Exception {
        // Limite noto, deciso: si rifiuta solo il nome intero, non le parole che lo contengono.
        register("mario@example.com", "Admin Mario").andExpect(status().isCreated());
    }

    @Test
    void register_collapsesRepeatedSpaces_andDuplicatesAreDetectedAfterwards() throws Exception {
        register("uno@example.com", "Marco   Rossi").andExpect(status().isCreated());

        assertThat(users.findByEmail("uno@example.com").orElseThrow().getDisplayName()).isEqualTo("Marco Rossi");
        register("due@example.com", "marco  rossi")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DISPLAY_NAME_TAKEN"));
    }

    @Test
    void register_againForTheSameUnverifiedEmailWithItsOwnName_isAccepted() throws Exception {
        register("mario@example.com", "Mario").andExpect(status().isCreated());
        clock.advance(Duration.ofSeconds(61));

        // Stesso nome, solo maiuscole diverse: il nome e' gia' suo, non c'e' conflitto con se stesso.
        register("mario@example.com", "MARIO").andExpect(status().isCreated());

        assertThat(users.count()).isEqualTo(1);
        assertThat(users.findByEmail("mario@example.com").orElseThrow().getDisplayName()).isEqualTo("MARIO");
    }

    @Test
    void register_againForAnUnverifiedEmailWithAnotherUsersName_returns409AndKeepsTheOldData() throws Exception {
        verifiedUser("anna@example.com", "Anna");
        register("mario@example.com", "Mario").andExpect(status().isCreated());
        clock.advance(Duration.ofSeconds(61));

        register("mario@example.com", "anna")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DISPLAY_NAME_TAKEN"));

        assertThat(users.findByEmail("mario@example.com").orElseThrow().getDisplayName()).isEqualTo("Mario");
    }

    // Ripetuto 10 volte: la corsa fra le due richieste dipende dai tempi, una sola esecuzione non basta.
    @RepeatedTest(10)
    void register_twoParallelRequestsForTheSameName_oneCreatesAndTheOtherGets409Never500() throws Exception {
        // Email diverse, stesso nome: entrambe vedono il nome libero e inseriscono; la seconda urta l'indice unico,
        // che GlobalExceptionHandler traduce in 409 DISPLAY_NAME_TAKEN.
        CyclicBarrier startTogether = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<MvcResult>> results = new ArrayList<>();
            for (String email : List.of("uno@example.com", "due@example.com")) {
                results.add(pool.submit(() -> {
                    startTogether.await(10, TimeUnit.SECONDS);
                    return register(email, "Marco").andReturn();
                }));
            }
            List<MvcResult> responses = new ArrayList<>();
            for (Future<MvcResult> result : results) {
                responses.add(result.get(30, TimeUnit.SECONDS));
            }

            assertThat(responses).extracting(r -> r.getResponse().getStatus()).containsExactlyInAnyOrder(201, 409);
            MvcResult conflict = responses.stream().filter(r -> r.getResponse().getStatus() == 409).findFirst()
                    .orElseThrow();
            assertThat(conflict.getResponse().getContentAsString()).contains("DISPLAY_NAME_TAKEN");
            assertThat(users.count()).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    // ------------------------------------------------------ modifica profilo

    @Test
    void patch_toANameTakenIgnoringCase_returns409AndKeepsTheOldName() throws Exception {
        verifiedUser("anna@example.com", "Anna");
        User mario = verifiedUser("mario@example.com", "Mario");

        patchName(mario, "ANNA")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DISPLAY_NAME_TAKEN"))
                .andExpect(jsonPath("$.message").value(TAKEN_MESSAGE));

        assertThat(users.findById(mario.getId()).orElseThrow().getDisplayName()).isEqualTo("Mario");
    }

    @Test
    void patch_changingOnlyTheCaseOfTheOwnName_isAccepted() throws Exception {
        User mario = verifiedUser("mario@example.com", "mario");

        patchName(mario, "Mario")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Mario"));
    }

    @Test
    void patch_toAReservedName_returns400AndKeepsTheOldName() throws Exception {
        User mario = verifiedUser("mario@example.com", "Mario");

        patchName(mario, "Moderator")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.displayName").value(RESERVED_MESSAGE));

        assertThat(users.findById(mario.getId()).orElseThrow().getDisplayName()).isEqualTo("Mario");
    }

    @Test
    void patch_sendingAnUnchangedReservedName_isAccepted() throws Exception {
        // Il superadmin si chiama "Superadmin": modificando solo la bio il frontend rimanda anche il nome, che non
        // cambia, quindi non va controllato (decisione 96, la regola non e' retroattiva).
        User superadmin = verifiedUser("super@example.com", "Superadmin");

        mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(superadmin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("displayName", "Superadmin", "bio", "Gestione"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Superadmin"))
                .andExpect(jsonPath("$.bio").value("Gestione"));
    }

    @Test
    void patch_collapsesRepeatedSpaces() throws Exception {
        User mario = verifiedUser("mario@example.com", "Mario");

        patchName(mario, "  Mario    Rossi ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Mario Rossi"));
    }

    @Test
    void patch_aNameLeftByItsOwnerBecomesAvailableAgain() throws Exception {
        User anna = verifiedUser("anna@example.com", "Anna");
        User mario = verifiedUser("mario@example.com", "Mario");
        patchName(mario, "Anna").andExpect(status().isConflict());

        patchName(anna, "Anna Bianchi").andExpect(status().isOk());

        patchName(mario, "Anna").andExpect(status().isOk());
        assertThat(users.findById(mario.getId()).orElseThrow().getDisplayName()).isEqualTo("Anna");
    }

    // Ripetuto 10 volte: la corsa fra le due richieste dipende dai tempi, una sola esecuzione non basta.
    @RepeatedTest(10)
    void patch_twoParallelRequestsForTheSameName_oneSucceedsAndTheOtherGets409Never500() throws Exception {
        List<User> owners = List.of(verifiedUser("uno@example.com", "Uno"), verifiedUser("due@example.com", "Due"));
        CyclicBarrier startTogether = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<MvcResult>> results = new ArrayList<>();
            for (User owner : owners) {
                results.add(pool.submit(() -> {
                    startTogether.await(10, TimeUnit.SECONDS);
                    return patchName(owner, "Nuovo Nome").andReturn();
                }));
            }
            List<MvcResult> responses = new ArrayList<>();
            for (Future<MvcResult> result : results) {
                responses.add(result.get(30, TimeUnit.SECONDS));
            }

            assertThat(responses).extracting(r -> r.getResponse().getStatus()).containsExactlyInAnyOrder(200, 409);
            MvcResult conflict = responses.stream().filter(r -> r.getResponse().getStatus() == 409).findFirst()
                    .orElseThrow();
            assertThat(conflict.getResponse().getContentAsString()).contains("DISPLAY_NAME_TAKEN");
            assertThat(users.findAll()).extracting(User::getDisplayName).containsOnlyOnce("Nuovo Nome");
        } finally {
            pool.shutdownNow();
        }
    }

    // --------------------------------------------------------------- aiuti

    private ResultActions register(String email, String displayName) throws Exception {
        return mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", PASSWORD,
                        "displayName", displayName))));
    }

    private ResultActions patchName(User user, String displayName) throws Exception {
        return mockMvc.perform(patch("/api/users/me").header("Authorization", bearer(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("displayName", displayName))));
    }

    private User verifiedUser(String email, String displayName) {
        User user = new User(email, "hash-di-prova", displayName);
        user.setEmailVerified(true);
        users.saveAndFlush(user);
        roles.save(new UserRole(user.getId(), Role.FAN));
        return user;
    }

    private String bearer(User user) {
        return "Bearer " + accessTokens.issue(user.getId()).token();
    }
}

package it.epicode.resonance.admin;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.UUID;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Elenco degli utenti per gli amministratori (progettazione, sezione 6.10): ricerca su email e nome con i caratteri
 * jolly del LIKE trattati come testo, filtro per stato, ordine fisso e paginazione con parametri validati.
 */
class AdminUserListIntegrationTest extends IntegrationTest {

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private AccessTokenService accessTokens;

    private User admin;

    @BeforeEach
    void createAdmin() {
        admin = user("admin-" + UUID.randomUUID() + "@example.com", "Amministratore", Role.ADMIN);
    }

    // ---------------------------------------------------------------- contenuto

    @Test
    void list_returnsPageResponse_withRolesAndSuspensionFields_andNoPasswordHash() throws Exception {
        user("uno@example.com", "Mario Rossi", Role.MUSICIAN);

        list("search", "uno@example.com")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.content[0].email").value("uno@example.com"))
                .andExpect(jsonPath("$.content[0].displayName").value("Mario Rossi"))
                .andExpect(jsonPath("$.content[0].roles", contains("FAN", "MUSICIAN")))
                .andExpect(jsonPath("$.content[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.content[0].emailVerified").value(true))
                .andExpect(jsonPath("$.content[0].createdAt").isNotEmpty())
                .andExpect(jsonPath("$.content[0].suspendedAt").doesNotExist())
                .andExpect(jsonPath("$.content[0].passwordHash").doesNotExist());
    }

    @Test
    void list_isOrderedByCreationDescending() throws Exception {
        user("a-ordine@example.com", "Ordine A");
        user("b-ordine@example.com", "Ordine B");
        user("c-ordine@example.com", "Ordine C");

        list("search", "ordine")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].displayName", contains("Ordine C", "Ordine B", "Ordine A")));
    }

    // ---------------------------------------------------------------- ricerca

    @Test
    void search_matchesEmail_andDisplayName_ignoringCase() throws Exception {
        user("chitarra@example.com", "Luca Bianchi");
        user("altro@example.com", "Giulia Chitarra");
        user("estraneo@example.com", "Paolo Verdi");

        list("search", "CHITARRA")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[*].email", contains("altro@example.com", "chitarra@example.com")));
    }

    @Test
    void search_treatsPercentAndUnderscoreAsPlainCharacters() throws Exception {
        user("p1@example.com", "Sconto 50% subito");
        user("p2@example.com", "Sconto 50 subito");
        user("u1@example.com", "Duo a_b");
        user("u2@example.com", "Duo axb");

        // Un "%" cercato come jolly troverebbe tutti gli utenti: qui solo chi lo contiene davvero.
        list("search", "50%")
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].email").value("p1@example.com"));
        list("search", "%")
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].email").value("p1@example.com"));
        // Lo stesso per "_", che nel LIKE sostituirebbe un carattere qualsiasi.
        list("search", "a_b")
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].email").value("u1@example.com"));
    }

    @Test
    void search_blank_returnsEveryone() throws Exception {
        user("tutti@example.com", "Tutti");

        // L'amministratore del test e l'altro utente.
        list("search", "  ").andExpect(jsonPath("$.totalElements").value(2));
    }

    // ---------------------------------------------------------------- filtro per stato

    @Test
    void status_filtersSuspendedAndActive() throws Exception {
        user("attivo@example.com", "Attivo");
        suspended(user("sospeso@example.com", "Sospeso"));

        list("status", "SUSPENDED")
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].email").value("sospeso@example.com"))
                .andExpect(jsonPath("$.content[0].status").value("SUSPENDED"))
                .andExpect(jsonPath("$.content[0].suspensionReason").value("Spam"))
                .andExpect(jsonPath("$.content[0].suspendedBy").isNotEmpty());
        list("status", "ACTIVE", "search", "attivo")
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].email").value("attivo@example.com"));
    }

    @Test
    void status_unknownValue_returns400() throws Exception {
        list("status", "BANNED")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    // ---------------------------------------------------------------- paginazione

    @Test
    void pagination_splitsTheResults() throws Exception {
        for (int i = 1; i <= 5; i++) {
            user("pag" + i + "@example.com", "Pagina " + i);
        }

        list("search", "pagina", "size", "2", "page", "1")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalElements").value(5))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.content[*].displayName", contains("Pagina 3", "Pagina 2")));
    }

    @Test
    void pagination_rejectsOutOfRange() throws Exception {
        list("page", "-1").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        list("size", "0").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        list("size", "1000").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    // ---------------------------------------------------------------- accesso

    @Test
    void list_asFan_returns403() throws Exception {
        User fan = user("fan@example.com", "Fan");

        mockMvc.perform(get("/api/admin/users").header("Authorization", bearer(fan)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void list_withoutToken_returns401_andSuperadminIsAllowed() throws Exception {
        mockMvc.perform(get("/api/admin/users"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        User superadmin = user("super@example.com", "Super", Role.SUPERADMIN);
        mockMvc.perform(get("/api/admin/users").header("Authorization", bearer(superadmin)))
                .andExpect(status().isOk());
    }

    @Test
    void appointedAdmin_canListWithTheTokenAlreadyIssued() throws Exception {
        User superadmin = user("capo@example.com", "Capo", Role.SUPERADMIN);
        User target = user("futuro@example.com", "Futuro admin");
        String token = bearer(target);
        mockMvc.perform(get("/api/admin/users").header("Authorization", token)).andExpect(status().isForbidden());

        mockMvc.perform(post("/api/superadmin/users/{id}/admin", target.getId())
                        .header("Authorization", bearer(superadmin)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/users").header("Authorization", token)).andExpect(status().isOk());
    }

    // ---------------------------------------------------------------- supporto

    /**
     * Chiama l'elenco con i parametri dati come coppie nome, valore (MockMvc li codifica da solo, quindi "%" resta "%").
     */
    private ResultActions list(String... nameValuePairs) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/admin/users").header("Authorization", bearer(admin));
        for (int i = 0; i < nameValuePairs.length; i += 2) {
            request.param(nameValuePairs[i], nameValuePairs[i + 1]);
        }
        return mockMvc.perform(request);
    }

    /**
     * Crea un utente verificato con FAN piu' i ruoli indicati.
     */
    private User user(String email, String displayName, Role... extraRoles) {
        User user = new User(email, "hash-di-prova", displayName);
        user.setEmailVerified(true);
        users.save(user);
        roles.save(new UserRole(user.getId(), Role.FAN));
        for (Role role : extraRoles) {
            roles.save(new UserRole(user.getId(), role));
        }
        return user;
    }

    private User suspended(User user) {
        user.setStatus(UserStatus.SUSPENDED);
        user.setSuspendedAt(clock.instant());
        user.setSuspendedBy(admin.getId());
        user.setSuspensionReason("Spam");
        return users.save(user);
    }

    private String bearer(User user) {
        return "Bearer " + accessTokens.issue(user.getId()).token();
    }
}

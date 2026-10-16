package it.epicode.resonance.friendship;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Ricerca utenti via HTTP (progettazione, sezione 6.5): accesso solo con il login, 400 sui parametri non validi,
 * forma della risposta senza dati privati, stato dell'amicizia, limite di frequenza e profilo pubblico che resta
 * raggiungibile. I filtri sulla query sono in UserSearchServiceTest.
 */
class UserSearchIntegrationTest extends IntegrationTest {

    @Autowired
    private AccessTokenService accessTokens;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private FriendshipRepository friendships;

    @Test
    void search_findsBySubstringIgnoringCase_andSkipsSelfUnverifiedAndSuspended() throws Exception {
        User me = user("me@example.com", "Marta Io");
        user("a@example.com", "Marco Rossi");
        User unverified = user("u@example.com", "Marco Ombra");
        unverified.setEmailVerified(false);
        users.save(unverified);
        User suspended = user("s@example.com", "Marco Sospeso");
        suspended.setStatus(UserStatus.SUSPENDED);
        suspended.setSuspendedAt(Instant.now());
        suspended.setSuspendedBy(me.getId());
        suspended.setSuspensionReason("prova");
        users.save(suspended);

        search(me, "mAr")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].displayName").value("Marco Rossi"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void search_resultHasNoEmailCoordinatesOrRoles() throws Exception {
        User me = user("me@example.com", "Io Stesso");
        User other = user("altra@example.com", "Chiara Verdi");
        other.setCity("Torino");
        other.setLatitude(45.07);
        other.setLongitude(7.68);
        users.save(other);

        search(me, "chiara")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(other.getId().toString()))
                .andExpect(jsonPath("$.content[0].city").value("Torino"))
                .andExpect(jsonPath("$.content[0].email").doesNotExist())
                .andExpect(jsonPath("$.content[0].latitude").doesNotExist())
                .andExpect(jsonPath("$.content[0].longitude").doesNotExist())
                .andExpect(jsonPath("$.content[0].roles").doesNotExist())
                .andExpect(jsonPath("$.content[0].passwordHash").doesNotExist());
    }

    @Test
    void search_withTooShortOrTooLongQuery_returns400() throws Exception {
        User me = user("me@example.com", "Io");

        search(me, "a").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        search(me, "   ").andExpect(status().isBadRequest());
        search(me, "x".repeat(51)).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/users/search").header("Authorization", bearer(me)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void search_withInvalidPaging_returns400() throws Exception {
        User me = user("me@example.com", "Io");

        search(me, "io", "size", "0").andExpect(status().isBadRequest());
        search(me, "io", "page", "-1").andExpect(status().isBadRequest());
    }

    @Test
    void search_percentIsSearchedLiterally() throws Exception {
        User me = user("me@example.com", "Io");
        user("a@example.com", "Sconto 50% Band");
        user("b@example.com", "Sconto 500 Band");

        search(me, "50%")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].displayName").value("Sconto 50% Band"));
    }

    @Test
    void search_showsFriendshipStateAndIdOnlyWhereNeeded() throws Exception {
        User me = user("me@example.com", "Io");
        User none = user("n@example.com", "Test Nessuno");
        User outgoing = user("o@example.com", "Test Inviata");
        User incoming = user("i@example.com", "Test Ricevuta");
        User friend = user("f@example.com", "Test Amico");
        Friendship out = friendships.saveAndFlush(new Friendship(me, outgoing, FriendshipStatus.PENDING, Instant.now()));
        Friendship in = friendships.saveAndFlush(new Friendship(incoming, me, FriendshipStatus.PENDING, Instant.now()));
        Friendship fr = friendships.saveAndFlush(new Friendship(friend, me, FriendshipStatus.ACCEPTED, Instant.now()));

        // Ordine per nome: Amico, Inviata, Nessuno, Ricevuta.
        search(me, "test")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(4))
                .andExpect(jsonPath("$.content[0].friendship.status").value("FRIENDS"))
                .andExpect(jsonPath("$.content[0].friendship.friendshipId").value(fr.getId().toString()))
                .andExpect(jsonPath("$.content[1].friendship.status").value("OUTGOING"))
                .andExpect(jsonPath("$.content[1].friendship.friendshipId").value(out.getId().toString()))
                .andExpect(jsonPath("$.content[2].id").value(none.getId().toString()))
                .andExpect(jsonPath("$.content[2].friendship.status").value("NONE"))
                .andExpect(jsonPath("$.content[2].friendship.friendshipId").doesNotExist())
                .andExpect(jsonPath("$.content[3].friendship.status").value("INCOMING"))
                .andExpect(jsonPath("$.content[3].friendship.friendshipId").value(in.getId().toString()));
    }

    @Test
    void search_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/users/search").param("q", "ab")).andExpect(status().isUnauthorized());
    }

    @Test
    void search_thirtyFirstInAMinute_returns429() throws Exception {
        User me = user("me@example.com", "Io");
        for (int i = 0; i < 30; i++) {
            search(me, "io").andExpect(status().isOk());
        }

        search(me, "io")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));
    }

    @Test
    void search_invalidRequestsCountTowardsTheLimit() throws Exception {
        User me = user("me@example.com", "Io");
        for (int i = 0; i < 30; i++) {
            search(me, "a").andExpect(status().isBadRequest());
        }

        // Il limite si consuma prima di validare q (decisione 64): la 31esima e' gia' un 429, non un 400.
        search(me, "a").andExpect(status().isTooManyRequests());
    }

    @Test
    void publicProfile_staysPublic_whileSearchRequiresLogin() throws Exception {
        User other = user("a@example.com", "Anna");

        mockMvc.perform(get("/api/users/{id}", other.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Anna"));
        mockMvc.perform(get("/api/users/{id}", UUID.randomUUID())).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/users/search").param("q", "an")).andExpect(status().isUnauthorized());
    }

    private ResultActions search(User caller, String q, String... extraParams) throws Exception {
        var request = get("/api/users/search").param("q", q).header("Authorization", bearer(caller));
        for (int i = 0; i < extraParams.length; i += 2) {
            request.param(extraParams[i], extraParams[i + 1]);
        }
        return mockMvc.perform(request);
    }

    private User user(String email, String displayName) {
        User user = new User(email, "hash-di-prova", displayName);
        user.setEmailVerified(true);
        users.save(user);
        roles.save(new UserRole(user.getId(), Role.FAN));
        return user;
    }

    private String bearer(User user) {
        return "Bearer " + accessTokens.issue(user.getId()).token();
    }
}

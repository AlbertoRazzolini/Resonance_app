package it.epicode.resonance.friendship;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Amicizie via HTTP (progettazione, sezione 6.14): richiesta con l'ordine dei controlli e i 409 per ogni stato
 * della riga, accetta, rifiuta silenzioso, annulla, rimuovi con i permessi e il 404 per chi non e' coinvolto,
 * ed elenchi. Ogni test legge lo stato di entrambe le parti, perche' il rifiuto silenzioso le fa divergere.
 */
class FriendshipIntegrationTest extends IntegrationTest {

    @Autowired
    private AccessTokenService accessTokens;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private FriendshipRepository friendships;

    @Autowired
    private FriendshipService friendshipService;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    // ---- richiesta ----

    @Test
    void request_returns201WithOutgoingStatus() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");

        request(a, b.getId())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.status").value("OUTGOING"))
                .andExpect(jsonPath("$.otherUser.id").value(b.getId().toString()))
                .andExpect(jsonPath("$.otherUser.displayName").value("Bruno"))
                .andExpect(jsonPath("$.otherUser.email").doesNotExist())
                .andExpect(jsonPath("$.updatedAt").exists());

        Friendship row = onlyRow();
        assertThat(row.getRequester().getId()).isEqualTo(a.getId());
        assertThat(row.getAddressee().getId()).isEqualTo(b.getId());
        assertThat(row.getStatus()).isEqualTo(FriendshipStatus.PENDING);
    }

    @Test
    void request_repeated_returns409AlreadySent() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        request(a, b.getId()).andExpect(status().isCreated());

        request(a, b.getId())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FRIEND_REQUEST_ALREADY_SENT"));
        assertThat(friendships.count()).isEqualTo(1);
    }

    @Test
    void request_inverse_returns409AlreadyReceived() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        request(a, b.getId()).andExpect(status().isCreated());

        // Il frontend propone "accetta" invece di una seconda richiesta.
        request(b, a.getId())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FRIEND_REQUEST_ALREADY_RECEIVED"));
        assertThat(friendships.count()).isEqualTo(1);
    }

    @Test
    void request_betweenFriends_returns409AlreadyFriends() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        row(a, b, FriendshipStatus.ACCEPTED);

        request(a, b.getId())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ALREADY_FRIENDS"));
        request(b, a.getId())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ALREADY_FRIENDS"));
    }

    @Test
    void request_toSelf_returns400() throws Exception {
        User a = user("a@example.com", "Alice");

        request(a, a.getId())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CANNOT_FRIEND_SELF"));
        assertThat(friendships.count()).isZero();
    }

    @Test
    void request_toUnknownUnverifiedOrSuspendedUser_returns404() throws Exception {
        User a = user("a@example.com", "Alice");
        User unverified = user("u@example.com", "Ugo");
        unverified.setEmailVerified(false);
        users.save(unverified);
        User suspended = user("s@example.com", "Sara");
        suspended.setStatus(UserStatus.SUSPENDED);
        suspended.setSuspendedAt(Instant.now());
        suspended.setSuspendedBy(a.getId());
        suspended.setSuspensionReason("prova");
        users.save(suspended);

        request(a, UUID.randomUUID()).andExpect(status().isNotFound());
        request(a, unverified.getId()).andExpect(status().isNotFound());
        request(a, suspended.getId()).andExpect(status().isNotFound());
        assertThat(friendships.count()).isZero();
    }

    @Test
    void request_withoutToken_returns401() throws Exception {
        User b = user("b@example.com", "Bruno");

        mockMvc.perform(post("/api/friendships")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b.getId())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void request_withoutUserId_returns400() throws Exception {
        User a = user("a@example.com", "Alice");

        mockMvc.perform(post("/api/friendships")
                        .header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.userId").exists());
    }

    // Il tentativo conta anche se fallisce (progettazione, sezione 6.14): dopo le 20 richieste, di cui 19 respinte
    // con 409, la 21esima in 24 ore e' un 429 senza arrivare ai controlli successivi.
    @Test
    void request_twentyFirstInADay_returns429() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        request(a, b.getId()).andExpect(status().isCreated());
        for (int i = 1; i < 20; i++) {
            request(a, b.getId()).andExpect(status().isConflict());
        }

        request(a, b.getId())
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));
        // Il limite e' per utente: un altro utente non ne risente.
        request(b, user("c@example.com", "Carla").getId()).andExpect(status().isCreated());
    }

    // ---- accetta ----

    @Test
    void accept_byAddressee_makesBothFriends() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.PENDING);

        act(b, "accept", row)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(row.getId().toString()))
                .andExpect(jsonPath("$.status").value("FRIENDS"))
                .andExpect(jsonPath("$.otherUser.id").value(a.getId().toString()));

        assertThat(viewOf(a, row)).isEqualTo(FriendshipView.FRIENDS);
        assertThat(viewOf(b, row)).isEqualTo(FriendshipView.FRIENDS);
    }

    @Test
    void accept_byRequester_returns403() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.PENDING);

        act(a, "accept", row)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_FRIENDSHIP_ADDRESSEE"));
        assertThat(reload(row).getStatus()).isEqualTo(FriendshipStatus.PENDING);
    }

    @Test
    void accept_twice_returns409() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.PENDING);
        act(b, "accept", row).andExpect(status().isOk());

        act(b, "accept", row)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FRIEND_REQUEST_NOT_PENDING"));
    }

    // Ordine dei controlli (decisione 63): il permesso viene prima dello stato, quindi chi non e' il destinatario
    // riceve 403 anche se la richiesta non e' piu' in attesa.
    @Test
    void accept_byRequesterOnANonPendingRow_returns403Not409() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.ACCEPTED);

        act(a, "accept", row)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_FRIENDSHIP_ADDRESSEE"));
    }

    @Test
    void accept_whenRequesterIsSuspended_returns409UserNotActive() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.PENDING);
        a.setStatus(UserStatus.SUSPENDED);
        a.setSuspendedAt(Instant.now());
        a.setSuspendedBy(b.getId());
        a.setSuspensionReason("prova");
        users.save(a);

        act(b, "accept", row)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USER_NOT_ACTIVE"));
        assertThat(reload(row).getStatus()).isEqualTo(FriendshipStatus.PENDING);
    }

    // ---- rifiuta (silenzioso) ----

    // Il rifiuto non si vede: chi ha chiesto resta con una richiesta "inviata", chi ha rifiutato non ha niente.
    @Test
    void decline_isSilentForTheRequester() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.PENDING);

        act(b, "decline", row).andExpect(status().isNoContent());

        Friendship declined = reload(row);
        assertThat(declined.getStatus()).isEqualTo(FriendshipStatus.DECLINED);
        assertThat(declined.getClosedBy()).isEqualTo(b.getId());
        assertThat(declined.isRequestMasked()).isTrue();
        assertThat(viewOf(a, row)).isEqualTo(FriendshipView.OUTGOING);
        assertThat(viewOf(b, row)).isEqualTo(FriendshipView.NONE);
        // Chi ha chiesto non puo' rifarlo (coerente con cio' che vede) e la riga non cambia.
        request(a, b.getId())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FRIEND_REQUEST_ALREADY_SENT"));
        assertThat(reload(row).getStatus()).isEqualTo(FriendshipStatus.DECLINED);
    }

    // Riapertura solo da chi ha chiuso: chi ha rifiutato puo' chiedere lui, e la riga cambia verso.
    @Test
    void decline_thenTheDeclinerRequests_reopensTheRowTheOtherWay() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.PENDING);
        act(b, "decline", row).andExpect(status().isNoContent());

        request(b, a.getId())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(row.getId().toString()))
                .andExpect(jsonPath("$.status").value("OUTGOING"));

        Friendship reopened = reload(row);
        assertThat(reopened.getStatus()).isEqualTo(FriendshipStatus.PENDING);
        assertThat(reopened.getRequester().getId()).isEqualTo(b.getId());
        assertThat(reopened.getClosedBy()).isNull();
        assertThat(reopened.isRequestMasked()).isFalse();
        assertThat(viewOf(a, row)).isEqualTo(FriendshipView.INCOMING);
        assertThat(friendships.count()).isEqualTo(1);
    }

    @Test
    void decline_byRequester_returns403() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.PENDING);

        act(a, "decline", row)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_FRIENDSHIP_ADDRESSEE"));
    }

    @Test
    void decline_twice_returns409() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.PENDING);
        act(b, "decline", row).andExpect(status().isNoContent());

        act(b, "decline", row)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FRIEND_REQUEST_NOT_PENDING"));
    }

    // ---- annulla ----

    @Test
    void cancel_pendingRequest_leavesBothWithNone() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.PENDING);

        act(a, "cancel", row).andExpect(status().isNoContent());

        assertThat(reload(row).getStatus()).isEqualTo(FriendshipStatus.CANCELLED);
        assertThat(viewOf(a, row)).isEqualTo(FriendshipView.NONE);
        assertThat(viewOf(b, row)).isEqualTo(FriendshipView.NONE);
        // La coppia e' neutra: possono chiedere tutti e due.
        request(b, a.getId()).andExpect(status().isCreated());
    }

    @Test
    void cancel_byAddressee_returns403() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.PENDING);

        act(b, "cancel", row)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_FRIENDSHIP_REQUESTER"));
        assertThat(reload(row).getStatus()).isEqualTo(FriendshipStatus.PENDING);
    }

    @Test
    void cancel_twiceOrWhenFriends_returns409() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship pending = row(a, b, FriendshipStatus.PENDING);
        act(a, "cancel", pending).andExpect(status().isNoContent());

        act(a, "cancel", pending)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FRIEND_REQUEST_NOT_PENDING"));

        User c = user("c@example.com", "Carla");
        User d = user("d@example.com", "Dario");
        Friendship accepted = row(c, d, FriendshipStatus.ACCEPTED);
        act(c, "cancel", accepted)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FRIEND_REQUEST_NOT_PENDING"));
    }

    // Annullare una richiesta rifiutata: per il richiedente torna NONE, il rifiuto resta; una sua nuova richiesta
    // riparte in silenzio, senza che il destinatario la veda come ricevuta.
    @Test
    void cancel_aDeclinedRequest_thenRequestingAgainStaysHiddenFromTheDecliner() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.PENDING);
        act(b, "decline", row).andExpect(status().isNoContent());

        act(a, "cancel", row).andExpect(status().isNoContent());

        assertThat(reload(row).getStatus()).isEqualTo(FriendshipStatus.DECLINED);
        assertThat(viewOf(a, row)).isEqualTo(FriendshipView.NONE);
        assertThat(viewOf(b, row)).isEqualTo(FriendshipView.NONE);

        request(a, b.getId())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("OUTGOING"));

        Friendship again = reload(row);
        assertThat(again.getStatus()).isEqualTo(FriendshipStatus.DECLINED);
        assertThat(again.isRequestMasked()).isTrue();
        assertThat(viewOf(a, row)).isEqualTo(FriendshipView.OUTGOING);
        assertThat(viewOf(b, row)).isEqualTo(FriendshipView.NONE);
    }

    // ---- rimuovi ----

    // Chi rimuove puo' chiedere di nuovo; l'altro vede UNAVAILABLE e non puo' chiedere.
    @Test
    void remove_byEitherParty_blocksTheOtherAndFreesTheRemover() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.ACCEPTED);

        act(a, "remove", row).andExpect(status().isNoContent());

        Friendship removed = reload(row);
        assertThat(removed.getStatus()).isEqualTo(FriendshipStatus.REMOVED);
        assertThat(removed.getClosedBy()).isEqualTo(a.getId());
        assertThat(viewOf(a, row)).isEqualTo(FriendshipView.NONE);
        assertThat(viewOf(b, row)).isEqualTo(FriendshipView.UNAVAILABLE);
        request(b, a.getId())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FRIENDSHIP_UNAVAILABLE"));

        request(a, b.getId()).andExpect(status().isCreated());
        assertThat(viewOf(b, row)).isEqualTo(FriendshipView.INCOMING);
    }

    @Test
    void remove_byTheAddressee_worksTheSameWay() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.ACCEPTED);

        act(b, "remove", row).andExpect(status().isNoContent());

        assertThat(viewOf(b, row)).isEqualTo(FriendshipView.NONE);
        assertThat(viewOf(a, row)).isEqualTo(FriendshipView.UNAVAILABLE);
    }

    @Test
    void remove_whenNotFriends_returns403() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.PENDING);

        act(a, "remove", row)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_FRIENDS"));
        assertThat(reload(row).getStatus()).isEqualTo(FriendshipStatus.PENDING);
    }

    // ---- non coinvolti e senza token ----

    @Test
    void aThirdUser_gets404OnEveryEndpoint() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        User outsider = user("c@example.com", "Carla");
        Friendship row = row(a, b, FriendshipStatus.PENDING);

        for (String verb : new String[]{"accept", "decline", "cancel", "remove"}) {
            act(outsider, verb, row).andExpect(status().isNotFound());
        }
        // Un id che non esiste e' indistinguibile da un'amicizia altrui.
        mockMvc.perform(post("/api/friendships/{id}/accept", UUID.randomUUID()).header("Authorization", bearer(a)))
                .andExpect(status().isNotFound());
        assertThat(reload(row).getStatus()).isEqualTo(FriendshipStatus.PENDING);
    }

    @Test
    void actions_withoutToken_return401() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.PENDING);

        mockMvc.perform(post("/api/friendships/{id}/accept", row.getId()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/friendships/{id}", row.getId()))
                .andExpect(status().isUnauthorized());
    }

    // ---- elenchi ----

    @Test
    void list_friends_returnsAcceptedRowsOfBothDirectionsMostRecentFirst() throws Exception {
        User me = user("me@example.com", "Io");
        User b = user("b@example.com", "Bruno");
        User c = user("c@example.com", "Carla");
        User d = user("d@example.com", "Dario");
        Instant base = Instant.parse("2026-10-16T10:00:00Z");
        row(me, b, FriendshipStatus.ACCEPTED, base);
        row(c, me, FriendshipStatus.ACCEPTED, base.plusSeconds(60));
        row(me, d, FriendshipStatus.PENDING, base.plusSeconds(120));

        list(me, "FRIENDS")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].otherUser.id").value(c.getId().toString()))
                .andExpect(jsonPath("$.content[0].status").value("FRIENDS"))
                .andExpect(jsonPath("$.content[1].otherUser.id").value(b.getId().toString()))
                .andExpect(jsonPath("$.content[1].otherUser.email").doesNotExist());
    }

    @Test
    void list_incoming_returnsOnlyPendingRequestsReceived() throws Exception {
        User me = user("me@example.com", "Io");
        User b = user("b@example.com", "Bruno");
        User c = user("c@example.com", "Carla");
        User d = user("d@example.com", "Dario");
        row(b, me, FriendshipStatus.PENDING);
        row(me, c, FriendshipStatus.PENDING);
        closedRow(d, me, FriendshipStatus.DECLINED, me, true);

        list(me, "INCOMING")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].otherUser.id").value(b.getId().toString()))
                .andExpect(jsonPath("$.content[0].status").value("INCOMING"));
    }

    // OUTGOING comprende il rifiuto silenzioso: chi ha chiesto lo vede ancora fra le richieste inviate.
    @Test
    void list_outgoing_includesTheMaskedDeclinedRequest() throws Exception {
        User me = user("me@example.com", "Io");
        User pending = user("p@example.com", "Paolo");
        User masked = user("m@example.com", "Marta");
        User cancelledByMe = user("c@example.com", "Carla");
        User incoming = user("d@example.com", "Dario");
        User received = user("r@example.com", "Rita");
        Instant base = Instant.parse("2026-10-16T10:00:00Z");
        row(me, pending, FriendshipStatus.PENDING, base);
        closedRow(me, masked, FriendshipStatus.DECLINED, masked, true, base.plusSeconds(60));
        // Rifiuto gia' annullato dal richiedente (maschera caduta): non e' piu' una richiesta inviata.
        closedRow(me, cancelledByMe, FriendshipStatus.DECLINED, cancelledByMe, false);
        // Richiesta ricevuta e rifiutata da me: non e' una richiesta inviata.
        closedRow(received, me, FriendshipStatus.DECLINED, me, true);
        // Richiesta in attesa ma ricevuta: e' fra le INCOMING.
        row(incoming, me, FriendshipStatus.PENDING);

        list(me, "OUTGOING")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].otherUser.id").value(masked.getId().toString()))
                .andExpect(jsonPath("$.content[0].status").value("OUTGOING"))
                .andExpect(jsonPath("$.content[1].otherUser.id").value(pending.getId().toString()));
    }

    @Test
    void list_isPaginatedAndShowsOnlyTheCallersRows() throws Exception {
        User me = user("me@example.com", "Io");
        User stranger = user("s@example.com", "Sara");
        Instant base = Instant.parse("2026-10-16T10:00:00Z");
        for (int i = 0; i < 3; i++) {
            row(me, user("f" + i + "@example.com", "Amico" + i), FriendshipStatus.ACCEPTED, base.plusSeconds(i));
        }

        mockMvc.perform(get("/api/friendships").param("type", "FRIENDS").param("size", "2").param("page", "1")
                        .header("Authorization", bearer(me)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
        list(stranger, "FRIENDS")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void list_withMissingOrUnknownType_returns400() throws Exception {
        User me = user("me@example.com", "Io");

        mockMvc.perform(get("/api/friendships").header("Authorization", bearer(me)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        list(me, "ALL")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void list_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/friendships").param("type", "FRIENDS"))
                .andExpect(status().isUnauthorized());
    }

    // ---- metodi condivisi (F4-05 e F5-02) ----

    @Test
    void areFriends_isTrueOnlyForAcceptedRowsInEitherDirection() {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        User c = user("c@example.com", "Carla");
        User d = user("d@example.com", "Dario");
        row(a, b, FriendshipStatus.ACCEPTED);
        row(c, a, FriendshipStatus.PENDING);
        closedRow(d, a, FriendshipStatus.REMOVED, d, false);

        assertThat(friendshipService.areFriends(a.getId(), b.getId())).isTrue();
        assertThat(friendshipService.areFriends(b.getId(), a.getId())).isTrue();
        assertThat(friendshipService.areFriends(a.getId(), c.getId())).isFalse();
        assertThat(friendshipService.areFriends(a.getId(), d.getId())).isFalse();
        assertThat(friendshipService.areFriends(a.getId(), UUID.randomUUID())).isFalse();
    }

    // Una sola query per tutti gli utenti; un utente non attivo e' UNAVAILABLE tranne se e' gia' amico (decisione 63).
    @Test
    void relationsFor_returnsTheViewOfEveryUserWithASingleQuery() {
        User me = user("me@example.com", "Io");
        User friend = user("f@example.com", "Fabio");
        User sent = user("s@example.com", "Sara");
        User received = user("r@example.com", "Rita");
        User stranger = user("x@example.com", "Xavier");
        User suspendedStranger = suspended(user("u1@example.com", "Ugo Uno"), me);
        User suspendedFriend = suspended(user("u2@example.com", "Ugo Due"), me);
        User unverified = user("u3@example.com", "Ugo Tre");
        unverified.setEmailVerified(false);
        users.save(unverified);
        User removedMe = user("u4@example.com", "Ugo Quattro");
        row(me, friend, FriendshipStatus.ACCEPTED);
        Friendship sentRow = row(me, sent, FriendshipStatus.PENDING);
        Friendship receivedRow = row(received, me, FriendshipStatus.PENDING);
        row(suspendedFriend, me, FriendshipStatus.ACCEPTED);
        closedRow(me, removedMe, FriendshipStatus.REMOVED, removedMe, false);
        UUID unknown = UUID.randomUUID();
        List<UUID> ids = List.of(friend.getId(), sent.getId(), received.getId(), stranger.getId(),
                suspendedStranger.getId(), suspendedFriend.getId(), unverified.getId(), removedMe.getId(), unknown);

        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        Map<UUID, FriendshipRelation> relations = friendshipService.relationsFor(me.getId(), ids);

        assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
        assertThat(relations).hasSize(ids.size());
        assertThat(relations.get(friend.getId()).status()).isEqualTo(FriendshipView.FRIENDS);
        assertThat(relations.get(sent.getId())).isEqualTo(new FriendshipRelation(FriendshipView.OUTGOING, sentRow.getId()));
        assertThat(relations.get(received.getId()))
                .isEqualTo(new FriendshipRelation(FriendshipView.INCOMING, receivedRow.getId()));
        assertThat(relations.get(stranger.getId())).isEqualTo(FriendshipRelation.NONE);
        assertThat(relations.get(suspendedStranger.getId())).isEqualTo(FriendshipRelation.UNAVAILABLE);
        assertThat(relations.get(suspendedFriend.getId()).status()).isEqualTo(FriendshipView.FRIENDS);
        assertThat(relations.get(unverified.getId())).isEqualTo(FriendshipRelation.UNAVAILABLE);
        // La riga e' REMOVED chiusa da lui, non da me: per me e' UNAVAILABLE.
        assertThat(relations.get(removedMe.getId())).isEqualTo(FriendshipRelation.UNAVAILABLE);
        assertThat(relations.get(unknown)).isEqualTo(FriendshipRelation.UNAVAILABLE);
    }

    @Test
    void relationsFor_withNoUsers_returnsAnEmptyMapAndIgnoresTheCaller() {
        User me = user("me@example.com", "Io");

        assertThat(friendshipService.relationsFor(me.getId(), List.of())).isEmpty();
        assertThat(friendshipService.relationsFor(me.getId(), List.of(me.getId()))).isEmpty();
    }

    // ---- stato con un utente (FE-16) ----

    @Test
    void stateWith_withoutRow_returnsNoneWithoutId() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");

        stateWith(a, b.getId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NONE"))
                .andExpect(jsonPath("$.friendshipId").doesNotExist());
    }

    @Test
    void stateWith_pendingRequest_isOutgoingForTheSenderAndIncomingForTheReceiver() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.PENDING);

        stateWith(a, b.getId())
                .andExpect(jsonPath("$.status").value("OUTGOING"))
                .andExpect(jsonPath("$.friendshipId").value(row.getId().toString()));
        stateWith(b, a.getId())
                .andExpect(jsonPath("$.status").value("INCOMING"))
                .andExpect(jsonPath("$.friendshipId").value(row.getId().toString()));
    }

    @Test
    void stateWith_acceptedRow_isFriendsForBothSides() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = row(a, b, FriendshipStatus.ACCEPTED);

        stateWith(a, b.getId())
                .andExpect(jsonPath("$.status").value("FRIENDS"))
                .andExpect(jsonPath("$.friendshipId").value(row.getId().toString()));
        stateWith(b, a.getId())
                .andExpect(jsonPath("$.status").value("FRIENDS"))
                .andExpect(jsonPath("$.friendshipId").value(row.getId().toString()));
    }

    // Come nell'elenco e nella ricerca: la rimozione fatta dall'altro e' UNAVAILABLE, la propria e' NONE.
    @Test
    void stateWith_removedRow_isUnavailableForTheOneWhoWasRemoved() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        closedRow(a, b, FriendshipStatus.REMOVED, b, false);

        stateWith(a, b.getId())
                .andExpect(jsonPath("$.status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.friendshipId").doesNotExist());
        stateWith(b, a.getId())
                .andExpect(jsonPath("$.status").value("NONE"));
    }

    // Il rifiuto silenzioso: chi ha chiesto continua a vedere la richiesta come inviata.
    @Test
    void stateWith_maskedDecline_staysOutgoingForTheRequester() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        Friendship row = closedRow(a, b, FriendshipStatus.DECLINED, b, true);

        stateWith(a, b.getId())
                .andExpect(jsonPath("$.status").value("OUTGOING"))
                .andExpect(jsonPath("$.friendshipId").value(row.getId().toString()));
        stateWith(b, a.getId())
                .andExpect(jsonPath("$.status").value("NONE"));
    }

    @Test
    void stateWith_self_returns400() throws Exception {
        User a = user("a@example.com", "Alice");

        stateWith(a, a.getId())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CANNOT_FRIEND_SELF"));
    }

    @Test
    void stateWith_unknownUnverifiedOrSuspendedUser_returns404() throws Exception {
        User a = user("a@example.com", "Alice");
        User unverified = user("u@example.com", "Ugo");
        unverified.setEmailVerified(false);
        users.save(unverified);
        User suspendedUser = suspended(user("s@example.com", "Sara"), a);

        stateWith(a, UUID.randomUUID()).andExpect(status().isNotFound());
        stateWith(a, unverified.getId()).andExpect(status().isNotFound());
        stateWith(a, suspendedUser.getId()).andExpect(status().isNotFound());
    }

    @Test
    void stateWith_withoutToken_returns401() throws Exception {
        User b = user("b@example.com", "Bruno");

        mockMvc.perform(get("/api/friendships/with/{userId}", b.getId()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    // Limite dedicato FRIENDSHIP_STATE (60 al minuto per utente): e' separato da quello delle richieste di amicizia.
    @Test
    void stateWith_sixtyFirstInAMinute_returns429() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        for (int i = 0; i < 60; i++) {
            stateWith(a, b.getId()).andExpect(status().isOk());
        }

        stateWith(a, b.getId())
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));
        // Il limite e' per utente e non tocca quello delle richieste: un altro utente e la richiesta vanno avanti.
        stateWith(b, a.getId()).andExpect(status().isOk());
        request(a, b.getId()).andExpect(status().isCreated());
        assertThat(friendships.count()).isEqualTo(1);
    }

    // Il limite si consuma per primo (decisione 64): la 61esima e' un 429 anche se sarebbe stata un 400.
    @Test
    void stateWith_errorsCountTowardsTheLimit() throws Exception {
        User a = user("a@example.com", "Alice");
        for (int i = 0; i < 60; i++) {
            stateWith(a, a.getId()).andExpect(status().isBadRequest());
        }

        stateWith(a, a.getId()).andExpect(status().isTooManyRequests());
    }

    // ---- supporto ----

    private ResultActions stateWith(User caller, UUID targetId) throws Exception {
        return mockMvc.perform(get("/api/friendships/with/{userId}", targetId).header("Authorization", bearer(caller)));
    }

    private ResultActions request(User caller, UUID targetId) throws Exception {
        return mockMvc.perform(post("/api/friendships")
                .header("Authorization", bearer(caller))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(targetId)));
    }

    /** Azione su una riga: accept, decline e cancel sono POST, remove e' la DELETE sulla risorsa. */
    private ResultActions act(User caller, String verb, Friendship row) throws Exception {
        if (verb.equals("remove")) {
            return mockMvc.perform(delete("/api/friendships/{id}", row.getId()).header("Authorization", bearer(caller)));
        }
        return mockMvc.perform(post("/api/friendships/{id}/" + verb, row.getId())
                .header("Authorization", bearer(caller)));
    }

    private Friendship reload(Friendship row) {
        return friendships.findById(row.getId()).orElseThrow();
    }

    /** Stato dell'amicizia visto da un utente, letto dalla riga: il rifiuto silenzioso fa divergere le due parti. */
    private FriendshipView viewOf(User viewer, Friendship row) {
        return reload(row).viewFor(viewer.getId());
    }

    private String body(UUID userId) {
        return "{\"userId\": \"" + userId + "\"}";
    }

    private Friendship onlyRow() {
        assertThat(friendships.count()).isEqualTo(1);
        return friendships.findAll().get(0);
    }

    /** Riga gia' nello stato indicato, scritta direttamente: i test degli altri stati non ripetono il percorso. */
    private Friendship row(User requester, User addressee, FriendshipStatus status) {
        return row(requester, addressee, status, Instant.now());
    }

    private Friendship row(User requester, User addressee, FriendshipStatus status, Instant updatedAt) {
        return friendships.saveAndFlush(new Friendship(requester, addressee, status, updatedAt));
    }

    /** Riga DECLINED o REMOVED, che per il vincolo del database deve avere chi l'ha chiusa. */
    private Friendship closedRow(User requester, User addressee, FriendshipStatus status, User closedBy,
                                 boolean masked) {
        return closedRow(requester, addressee, status, closedBy, masked, Instant.now());
    }

    private Friendship closedRow(User requester, User addressee, FriendshipStatus status, User closedBy,
                                 boolean masked, Instant updatedAt) {
        Friendship row = new Friendship(requester, addressee, status, updatedAt);
        row.setClosedBy(closedBy.getId());
        row.setRequestMasked(masked);
        return friendships.saveAndFlush(row);
    }

    private ResultActions list(User caller, String type) throws Exception {
        return mockMvc.perform(get("/api/friendships").param("type", type).header("Authorization", bearer(caller)));
    }

    private User suspended(User user, User by) {
        user.setStatus(UserStatus.SUSPENDED);
        user.setSuspendedAt(Instant.now());
        user.setSuspendedBy(by.getId());
        user.setSuspensionReason("prova");
        return users.save(user);
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

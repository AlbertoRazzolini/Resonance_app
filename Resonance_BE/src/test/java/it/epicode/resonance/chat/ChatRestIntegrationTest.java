package it.epicode.resonance.chat;

import it.epicode.resonance.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Chat via HTTP (progettazione, sezione 6.9): apertura di una conversazione con l'ordine dei controlli (decisione
 * 66), lista con ultimo messaggio e non letti, storico a cursore e lettura con i controlli di appartenenza.
 */
class ChatRestIntegrationTest extends ChatTestSupport {

    // ---- POST /api/chats ----

    @Test
    void open_betweenFriends_returnsTheSameConversationFromBothSides() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        befriend(a, b);

        String fromA = open(a, b.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.otherUser.id").value(b.getId().toString()))
                .andExpect(jsonPath("$.otherUser.email").doesNotExist())
                .andExpect(jsonPath("$.lastMessage").doesNotExist())
                .andExpect(jsonPath("$.unreadCount").value(0))
                .andExpect(jsonPath("$.canSend").value(true))
                .andReturn().getResponse().getContentAsString();
        open(b, a.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.otherUser.id").value(a.getId().toString()));

        assertThat(conversations.count()).isEqualTo(1);
        ChatConversation row = conversations.findAll().get(0);
        assertThat(fromA).contains(row.getId().toString());
        // Coppia canonica: lo stesso ordine degli id che usa il database.
        assertThat(row.getUserA().getId().toString()).isLessThan(row.getUserB().getId().toString());
    }

    @Test
    void open_betweenNonFriends_returns403NotFriendsAndCreatesNothing() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");

        open(a, b.getId())
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_FRIENDS"));
        assertThat(conversations.count()).isZero();
    }

    @Test
    void open_existingConversationAfterFriendshipRemoved_isStillReturned() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        var friendship = befriend(a, b);
        open(a, b.getId()).andExpect(status().isOk());
        friendships.delete(friendship);

        // Lo storico resta leggibile: la conversazione si restituisce anche se non si puo' piu' scrivere.
        open(a, b.getId()).andExpect(status().isOk()).andExpect(jsonPath("$.canSend").value(false));
        open(b, a.getId()).andExpect(status().isOk()).andExpect(jsonPath("$.canSend").value(false));
        assertThat(conversations.count()).isEqualTo(1);
    }

    @Test
    void open_toSelf_returns400() throws Exception {
        User a = user("a@example.com", "Alice");

        open(a, a.getId())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CANNOT_MESSAGE_SELF"));
    }

    @Test
    void open_toUnknownUnverifiedOrSuspendedUser_returns404() throws Exception {
        User a = user("a@example.com", "Alice");
        User unverified = user("u@example.com", "Ugo");
        unverified.setEmailVerified(false);
        users.save(unverified);
        User sus = suspended(user("s@example.com", "Sara"), a);
        befriend(a, sus);

        open(a, UUID.randomUUID()).andExpect(status().isNotFound());
        open(a, unverified.getId()).andExpect(status().isNotFound());
        // Anche se erano amici: un sospeso non si puo' contattare per la prima volta.
        open(a, sus.getId()).andExpect(status().isNotFound());
        assertThat(conversations.count()).isZero();
    }

    @Test
    void open_existingConversationWithSuspendedUser_isReturnedButNotWritable() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        befriend(a, b);
        open(a, b.getId()).andExpect(status().isOk()).andExpect(jsonPath("$.canSend").value(true));
        suspended(b, a);

        open(a, b.getId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canSend").value(false));
    }

    @Test
    void open_withoutRecipientOrToken_isRejected() throws Exception {
        User a = user("a@example.com", "Alice");

        mockMvc.perform(post("/api/chats").header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mockMvc.perform(post("/api/chats").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"recipientId\": \"" + a.getId() + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void open_twentyFirstNewConversationInADay_returns429() throws Exception {
        User a = user("a@example.com", "Alice");
        for (int i = 0; i < 20; i++) {
            User friend = user("f" + i + "@example.com", "Amico " + i);
            befriend(a, friend);
            open(a, friend.getId()).andExpect(status().isOk());
        }
        User last = user("ultimo@example.com", "Ultimo");
        befriend(a, last);

        open(a, last.getId())
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));

        clock.advance(Duration.ofHours(25));
        open(a, last.getId()).andExpect(status().isOk());
    }

    @Test
    void open_rejectionsAndExistingConversations_doNotConsumeTheLimit() throws Exception {
        User a = user("a@example.com", "Alice");
        User friend = user("amico@example.com", "Amico");
        befriend(a, friend);
        // 30 rifiuti NOT_FRIENDS e 30 riletture della stessa conversazione: nessuna creazione consumata.
        for (int i = 0; i < 30; i++) {
            User stranger = user("x" + i + "@example.com", "Estraneo " + i);
            open(a, stranger.getId()).andExpect(status().isForbidden());
        }
        for (int i = 0; i < 30; i++) {
            open(a, friend.getId()).andExpect(status().isOk());
        }
        // Le 20 creazioni sono ancora tutte disponibili.
        for (int i = 0; i < 19; i++) {
            User other = user("o" + i + "@example.com", "Altro " + i);
            befriend(a, other);
            open(a, other.getId()).andExpect(status().isOk());
        }
    }

    // ---- GET /api/chats ----

    @Test
    void list_ordersByLastActivityWithLastMessageAndUnreadCount() throws Exception {
        User me = user("me@example.com", "Io");
        User old = user("old@example.com", "Vecchio");
        User recent = user("recent@example.com", "Recente");
        User empty = user("empty@example.com", "Vuoto");
        befriend(me, old);
        befriend(me, recent);
        befriend(me, empty);
        Instant now = Instant.now();
        ChatConversation withOld = conversation(me, old);
        ChatConversation withRecent = conversation(me, recent);
        conversation(me, empty);
        message(withOld, old, "ciao", now.minusSeconds(3600));
        message(withRecent, recent, "primo", now.minusSeconds(120));
        message(withRecent, recent, "secondo", now.minusSeconds(90));
        message(withRecent, me, "mio", now.minusSeconds(60));

        mockMvc.perform(get("/api/chats").header("Authorization", bearer(me)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].otherUser.displayName").value("Recente"))
                .andExpect(jsonPath("$.content[0].lastMessage.body").value("mio"))
                .andExpect(jsonPath("$.content[0].lastMessage.senderId").value(me.getId().toString()))
                // Non letti: solo i messaggi dell'altro (due), non il mio.
                .andExpect(jsonPath("$.content[0].unreadCount").value(2))
                .andExpect(jsonPath("$.content[1].otherUser.displayName").value("Vecchio"))
                .andExpect(jsonPath("$.content[1].unreadCount").value(1))
                // Senza messaggi in fondo, con ultimo messaggio nullo.
                .andExpect(jsonPath("$.content[2].otherUser.displayName").value("Vuoto"))
                .andExpect(jsonPath("$.content[2].lastMessage").doesNotExist())
                .andExpect(jsonPath("$.content[2].lastMessageAt").doesNotExist())
                .andExpect(jsonPath("$.content[2].unreadCount").value(0));
    }

    @Test
    void list_showsOnlyMyConversationsAndRequiresLogin() throws Exception {
        User me = user("me@example.com", "Io");
        User b = user("b@example.com", "Bruno");
        User c = user("c@example.com", "Carla");
        befriend(b, c);
        conversation(b, c);
        befriend(me, b);
        conversation(me, b);

        mockMvc.perform(get("/api/chats").header("Authorization", bearer(me)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        mockMvc.perform(get("/api/chats")).andExpect(status().isUnauthorized());
    }

    // ---- GET /api/chats/{id}/messages ----

    @Test
    void messages_cursorPagination_returnsPagesWithoutLossOrDuplicates() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        ChatConversation conversation = conversation(a, b);
        Instant start = Instant.now().minusSeconds(3600);
        for (int i = 1; i <= 35; i++) {
            message(conversation, i % 2 == 0 ? a : b, "m" + i, start.plusSeconds(i));
        }

        String first = mockMvc.perform(get("/api/chats/{id}/messages", conversation.getId())
                        .param("size", "30").header("Authorization", bearer(a)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages.length()").value(30))
                .andExpect(jsonPath("$.hasMore").value(true))
                .andExpect(jsonPath("$.messages[0].body").value("m35"))
                .andExpect(jsonPath("$.messages[29].body").value("m6"))
                .andReturn().getResponse().getContentAsString();
        String oldestLoaded = com.jayway.jsonpath.JsonPath.read(first, "$.messages[29].id");

        mockMvc.perform(get("/api/chats/{id}/messages", conversation.getId())
                        .param("size", "30").param("before", oldestLoaded)
                        .header("Authorization", bearer(a)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages.length()").value(5))
                .andExpect(jsonPath("$.hasMore").value(false))
                .andExpect(jsonPath("$.messages[0].body").value("m5"))
                .andExpect(jsonPath("$.messages[4].body").value("m1"));
    }

    @Test
    void messages_sameSentAt_areNotLostOrDuplicatedAcrossPages() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        ChatConversation conversation = conversation(a, b);
        Instant sameInstant = Instant.now().minusSeconds(600);
        for (int i = 0; i < 5; i++) {
            message(conversation, a, "stesso-" + i, sameInstant);
        }

        // Pagine da 2: a parita' di istante decide l'id, quindi ogni messaggio compare una sola volta.
        java.util.Set<String> seen = new java.util.HashSet<>();
        String before = null;
        boolean hasMore = true;
        while (hasMore) {
            var request = get("/api/chats/{id}/messages", conversation.getId())
                    .param("size", "2").header("Authorization", bearer(a));
            if (before != null) {
                request.param("before", before);
            }
            String body = mockMvc.perform(request).andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();
            java.util.List<String> ids = com.jayway.jsonpath.JsonPath.read(body, "$.messages[*].id");
            for (String id : ids) {
                assertThat(seen.add(id)).as("messaggio duplicato " + id).isTrue();
            }
            hasMore = com.jayway.jsonpath.JsonPath.read(body, "$.hasMore");
            before = ids.get(ids.size() - 1);
        }
        assertThat(seen).hasSize(5);
    }

    @Test
    void messages_beforeFromAnotherConversation_returns404() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        User c = user("c@example.com", "Carla");
        ChatConversation mine = conversation(a, b);
        ChatConversation other = conversation(a, c);
        ChatMessage foreign = message(other, c, "altrove", Instant.now().minusSeconds(10));

        mockMvc.perform(get("/api/chats/{id}/messages", mine.getId())
                        .param("before", foreign.getId().toString()).header("Authorization", bearer(a)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void messages_nonMember_returns403AndUnknownConversation404() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        User intruder = user("i@example.com", "Intruso");
        ChatConversation conversation = conversation(a, b);
        message(conversation, a, "privato", Instant.now());

        mockMvc.perform(get("/api/chats/{id}/messages", conversation.getId())
                        .header("Authorization", bearer(intruder)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_CONVERSATION_MEMBER"));
        mockMvc.perform(get("/api/chats/{id}/messages", UUID.randomUUID())
                        .header("Authorization", bearer(a)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/chats/{id}/messages", conversation.getId()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void messages_sizeOutOfRange_returns400() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        ChatConversation conversation = conversation(a, b);

        for (String size : new String[]{"0", "101", "-1"}) {
            mockMvc.perform(get("/api/chats/{id}/messages", conversation.getId())
                            .param("size", size).header("Authorization", bearer(a)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        }
    }

    @Test
    void messages_stayReadableAfterFriendshipRemoved() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        var friendship = befriend(a, b);
        ChatConversation conversation = conversation(a, b);
        message(conversation, a, "ciao", Instant.now());
        friendships.delete(friendship);

        mockMvc.perform(get("/api/chats/{id}/messages", conversation.getId())
                        .header("Authorization", bearer(b)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages.length()").value(1));
    }

    // ---- PATCH /api/chats/{id}/read ----

    @Test
    void read_marksOnlyTheOthersMessagesAndLeavesMineUnchanged() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        befriend(a, b);
        ChatConversation conversation = conversation(a, b);
        message(conversation, a, "da A", Instant.now().minusSeconds(20));
        message(conversation, b, "da B", Instant.now().minusSeconds(10));

        mockMvc.perform(patch("/api/chats/{id}/read", conversation.getId()).header("Authorization", bearer(a)))
                .andExpect(status().isNoContent());

        // A ha letto "da B": per A non restano non letti. Per B resta non letto "da A".
        assertThat(unreadFor(a)).isZero();
        assertThat(unreadFor(b)).isEqualTo(1);
        // La lettura e' idempotente.
        mockMvc.perform(patch("/api/chats/{id}/read", conversation.getId()).header("Authorization", bearer(a)))
                .andExpect(status().isNoContent());
        assertThat(unreadFor(b)).isEqualTo(1);
    }

    @Test
    void read_nonMember_returns403AndWithoutTokenReturns401() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        User intruder = user("i@example.com", "Intruso");
        ChatConversation conversation = conversation(a, b);
        message(conversation, a, "ciao", Instant.now());

        mockMvc.perform(patch("/api/chats/{id}/read", conversation.getId()).header("Authorization", bearer(intruder)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_CONVERSATION_MEMBER"));
        mockMvc.perform(patch("/api/chats/{id}/read", conversation.getId())).andExpect(status().isUnauthorized());
        // Il messaggio di A e' rimasto non letto per B.
        assertThat(unreadFor(b)).isEqualTo(1);
    }

    // ---- helper ----

    private ResultActions open(User caller, UUID recipientId) throws Exception {
        return mockMvc.perform(post("/api/chats").header("Authorization", bearer(caller))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"recipientId\": \"" + recipientId + "\"}"));
    }

    /** I non letti di un utente, come li vede nella lista delle conversazioni. */
    private int unreadFor(User user) throws Exception {
        String body = mockMvc.perform(get("/api/chats").header("Authorization", bearer(user)))
                .andReturn().getResponse().getContentAsString();
        java.util.List<Integer> counts = com.jayway.jsonpath.JsonPath.read(body, "$.content[*].unreadCount");
        return counts.stream().mapToInt(Integer::intValue).sum();
    }
}

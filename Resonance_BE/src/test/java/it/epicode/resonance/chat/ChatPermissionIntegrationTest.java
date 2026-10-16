package it.epicode.resonance.chat;

import it.epicode.resonance.user.User;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Permesso di scrittura (progettazione, sezione 6.9; decisione 59): amici oppure uno sblocco con l'origine ancora
 * aperta, e solo se entrambi i membri sono attivi. Gli sblocchi si inseriscono direttamente nel database:
 * candidature e contatti arrivano con F5-03 e F5-04. Ogni caso controlla sia {@code canSend} del servizio sia quello
 * della lista, calcolato per pagina con un'altra strada.
 */
class ChatPermissionIntegrationTest extends ChatTestSupport {

    @Test
    void friends_canSend_andAfterRemovalCannotButTheyStillSeeListAndHistory() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        var friendship = befriend(a, b);
        ChatConversation conversation = conversation(a, b);
        message(conversation, a, "ciao", Instant.now());
        assertCanSend(conversation, a, true);

        friendships.delete(friendship);

        assertCanSend(conversation, a, false);
        assertCanSend(conversation, b, false);
        mockMvc.perform(get("/api/chats/{id}/messages", conversation.getId()).header("Authorization", bearer(b)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages.length()").value(1));
    }

    @Test
    void strangersWithoutUnlock_cannotSend() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        ChatConversation conversation = conversation(a, b);

        assertCanSend(conversation, a, false);
    }

    // ---- COLLAB_POST ----

    @Test
    void collabUnlock_isOpenWhileThePostIsOpen_andClosedWhenClosedOrHidden() throws Exception {
        User musician = user("m@example.com", "Musicista");
        User applicant = user("c@example.com", "Candidato");
        User admin = user("admin@example.com", "Admin");
        UUID postId = openCollabPost(musician);
        ChatConversation conversation = conversation(musician, applicant);
        chatService.unlock(conversation, ChatUnlockSource.COLLAB_POST, postId);
        assertCanSend(conversation, applicant, true);

        jdbc.update("update collab_posts set is_open = false where id = ?", postId);
        assertCanSend(conversation, applicant, false);

        jdbc.update("update collab_posts set is_open = true where id = ?", postId);
        assertCanSend(conversation, applicant, true);
        hide("collab_posts", postId, admin);
        assertCanSend(conversation, applicant, false);
    }

    // ---- OFFICIAL_CONCERT ----

    @Test
    void concertUnlock_isOpenUntilTheEventStarts_thenClosed() throws Exception {
        User host = user("h@example.com", "Locale");
        User fan = user("f@example.com", "Fan");
        UUID concertId = officialConcert(host, clock.instant().plus(Duration.ofHours(2)));
        ChatConversation conversation = conversation(host, fan);
        chatService.unlock(conversation, ChatUnlockSource.OFFICIAL_CONCERT, concertId);
        assertCanSend(conversation, fan, true);

        clock.advance(Duration.ofHours(3));

        assertCanSend(conversation, fan, false);
    }

    @Test
    void concertUnlock_isClosedWhenTheConcertIsHidden() throws Exception {
        User host = user("h@example.com", "Locale");
        User fan = user("f@example.com", "Fan");
        User admin = user("admin@example.com", "Admin");
        UUID concertId = officialConcert(host, clock.instant().plus(Duration.ofDays(1)));
        ChatConversation conversation = conversation(host, fan);
        chatService.unlock(conversation, ChatUnlockSource.OFFICIAL_CONCERT, concertId);
        assertCanSend(conversation, fan, true);

        hide("official_concerts", concertId, admin);

        assertCanSend(conversation, fan, false);
    }

    // ---- INDIE_EVENT ----

    @Test
    void indieUnlock_needsPublishedFutureAndVisibleEvent() throws Exception {
        User musician = user("m@example.com", "Musicista");
        User fan = user("f@example.com", "Fan");
        User admin = user("admin@example.com", "Admin");
        Instant future = clock.instant().plus(Duration.ofDays(1));

        UUID draft = indieEvent(musician, future, "DRAFT");
        ChatConversation draftChat = conversation(musician, fan);
        chatService.unlock(draftChat, ChatUnlockSource.INDIE_EVENT, draft);
        assertCanSend(draftChat, fan, false);

        jdbc.update("update indie_events set status = 'PUBLISHED' where id = ?", draft);
        assertCanSend(draftChat, fan, true);

        hide("indie_events", draft, admin);
        assertCanSend(draftChat, fan, false);

        UUID past = indieEvent(musician, clock.instant().minus(Duration.ofHours(1)), "PUBLISHED");
        User other = user("o@example.com", "Altro");
        ChatConversation pastChat = conversation(musician, other);
        chatService.unlock(pastChat, ChatUnlockSource.INDIE_EVENT, past);
        assertCanSend(pastChat, other, false);
    }

    // ---- unlock ----

    @Test
    void unlock_repeatedFromTheSameSource_createsOneRowOnly() throws Exception {
        User musician = user("m@example.com", "Musicista");
        User applicant = user("c@example.com", "Candidato");
        UUID postId = openCollabPost(musician);
        ChatConversation conversation = conversation(musician, applicant);

        chatService.unlock(conversation, ChatUnlockSource.COLLAB_POST, postId);
        chatService.unlock(conversation, ChatUnlockSource.COLLAB_POST, postId);

        assertThat(jdbc.queryForObject("select count(*) from chat_unlocks", Integer.class)).isEqualTo(1);
    }

    @Test
    void anyOpenUnlock_isEnough_whenAnotherIsClosed() throws Exception {
        User musician = user("m@example.com", "Musicista");
        User fan = user("f@example.com", "Fan");
        UUID closedPost = openCollabPost(musician);
        jdbc.update("update collab_posts set is_open = false where id = ?", closedPost);
        UUID futureConcert = officialConcert(user("h@example.com", "Locale"), clock.instant().plus(Duration.ofDays(1)));
        ChatConversation conversation = conversation(musician, fan);
        chatService.unlock(conversation, ChatUnlockSource.COLLAB_POST, closedPost);
        assertCanSend(conversation, fan, false);

        chatService.unlock(conversation, ChatUnlockSource.OFFICIAL_CONCERT, futureConcert);

        assertCanSend(conversation, fan, true);
    }

    @Test
    void unlockOfAnUnknownSource_doesNotOpenTheChat() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        ChatConversation conversation = conversation(a, b);

        // source_id non ha FK: un id che non punta a niente non deve mai sbloccare.
        chatService.unlock(conversation, ChatUnlockSource.COLLAB_POST, UUID.randomUUID());

        assertCanSend(conversation, a, false);
    }

    // ---- membro sospeso (decisione 66) ----

    @Test
    void suspendedMember_blocksWritingEvenBetweenFriends_untilTheSuspensionEnds() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        befriend(a, b);
        ChatConversation conversation = conversation(a, b);
        assertCanSend(conversation, a, true);

        b.setStatus(it.epicode.resonance.user.UserStatus.SUSPENDED);
        b.setSuspendedAt(Instant.now());
        b.setSuspendedBy(a.getId());
        b.setSuspensionReason("prova");
        b.setSuspendedUntil(clock.instant().plus(Duration.ofDays(2)));
        users.save(b);
        assertCanSend(conversation, a, false);

        // Sospensione scaduta: conta come attivo, come nella riattivazione pigra.
        clock.advance(Duration.ofDays(3));
        assertCanSend(conversation, a, true);
    }

    @Test
    void suspendedMember_blocksWritingOnUnlockedConversationsToo() throws Exception {
        User musician = user("m@example.com", "Musicista");
        User fan = user("f@example.com", "Fan");
        UUID postId = openCollabPost(musician);
        ChatConversation conversation = conversation(musician, fan);
        chatService.unlock(conversation, ChatUnlockSource.COLLAB_POST, postId);
        assertCanSend(conversation, fan, true);

        suspended(musician, fan);

        assertCanSend(conversation, fan, false);
    }

    // ---- lista: canSend per pagina ----

    @Test
    void list_computesCanSendPerConversationInTheSamePage() throws Exception {
        User me = user("me@example.com", "Io");
        User friend = user("amico@example.com", "Amico");
        User stranger = user("estraneo@example.com", "Estraneo");
        User unlockedUser = user("sbloccato@example.com", "Sbloccato");
        User formerFriend = user("ex@example.com", "Ex");
        User host = user("h@example.com", "Locale");
        befriend(me, friend);
        conversation(me, friend);
        conversation(me, stranger);
        ChatConversation unlocked = conversation(me, unlockedUser);
        chatService.unlock(unlocked, ChatUnlockSource.OFFICIAL_CONCERT,
                officialConcert(host, clock.instant().plus(Duration.ofDays(1))));
        var friendship = befriend(me, formerFriend);
        conversation(me, formerFriend);
        friendships.delete(friendship);

        String body = mockMvc.perform(get("/api/chats").header("Authorization", bearer(me)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(canSendIn(body, "Amico")).isTrue();
        assertThat(canSendIn(body, "Sbloccato")).isTrue();
        assertThat(canSendIn(body, "Estraneo")).isFalse();
        assertThat(canSendIn(body, "Ex")).isFalse();
    }

    // ---- helper ----

    /**
     * Controlla il permesso dal servizio e dalla lista del membro indicato: le due strade devono dare lo
     * stesso risultato.
     */
    private void assertCanSend(ChatConversation conversation, User viewer, boolean expected) throws Exception {
        assertThat(chatService.canSend(conversation)).as("canSend del servizio").isEqualTo(expected);
        String body = mockMvc.perform(get("/api/chats").header("Authorization", bearer(viewer)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        java.util.List<Boolean> values = com.jayway.jsonpath.JsonPath.read(body,
                "$.content[?(@.id == '" + conversation.getId() + "')].canSend");
        assertThat(values).as("canSend della lista").containsExactly(expected);
    }

    private boolean canSendIn(String listBody, String otherDisplayName) {
        java.util.List<Boolean> values = com.jayway.jsonpath.JsonPath.read(listBody,
                "$.content[?(@.otherUser.displayName == '" + otherDisplayName + "')].canSend");
        assertThat(values).hasSize(1);
        return values.get(0);
    }
}

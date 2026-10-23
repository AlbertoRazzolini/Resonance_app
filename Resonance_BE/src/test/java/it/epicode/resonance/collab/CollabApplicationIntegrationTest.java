package it.epicode.resonance.collab;

import it.epicode.resonance.chat.ChatConversation;
import it.epicode.resonance.chat.ChatTestSupport;
import it.epicode.resonance.notification.NotificationRepository;
import it.epicode.resonance.support.StompTestClient;
import it.epicode.resonance.support.StompTestClient.Connection;
import it.epicode.resonance.user.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.web.servlet.ResultActions;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Candidature agli annunci (progettazione, sezioni 6.7 e 6.9; decisione 59): controlli e codici d'errore, messaggio
 * in chat e notifica COLLAB_APPLICATION dopo il commit, sblocco che permette a due non amici di scriversi finche'
 * l'annuncio e' aperto e poi CHAT_LOCKED, candidatura unica per annuncio e utente (anche con due richieste
 * insieme) con COLLAB_ALREADY_APPLIED.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CollabApplicationIntegrationTest extends ChatTestSupport {

    private static final String BODY = "{\"message\": \"Suono la batteria da dieci anni\"}";

    @LocalServerPort
    private int port;

    @Autowired
    private SimpMessagingTemplate template;

    @Autowired
    private NotificationRepository notifications;

    private StompTestClient stomp;

    @BeforeEach
    void openClient() {
        stomp = new StompTestClient(port, template);
    }

    @AfterEach
    void closeClient() {
        stomp.close();
    }

    // ---- candidatura ----

    @Test
    void apply_createsConversationUnlockAndMessage_withoutFriendship() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID postId = openCollabPost(author);

        String response = apply(applicant, postId, BODY)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.conversationId").exists())
                .andExpect(jsonPath("$.messageId").exists())
                .andReturn().getResponse().getContentAsString();

        assertThat(conversations.count()).isEqualTo(1);
        ChatConversation conversation = conversations.findAll().get(0);
        assertThat(response).contains(conversation.getId().toString());
        var saved = messages.findAll();
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getBody())
                .isEqualTo("Candidatura per «Cerco batterista»:\nSuono la batteria da dieci anni");
        assertThat(saved.get(0).getSender().getId()).isEqualTo(applicant.getId());
        assertThat(conversation.getLastMessageAt()).isNotNull();
        assertThat(unlockRows(conversation)).isEqualTo(1);
    }

    @Test
    void apply_deliversMessageToBoth_andOnlyCollabApplicationToTheAuthor() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID postId = openCollabPost(author);
        Live authorLive = live(author);
        Live applicantLive = live(applicant);

        apply(applicant, postId, BODY).andExpect(status().isCreated());

        Map<String, Object> toAuthor = authorLive.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        Map<String, Object> toApplicant = applicantLive.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        assertThat(toAuthor).isNotNull().containsEntry("senderId", applicant.getId().toString());
        assertThat(toApplicant).isEqualTo(toAuthor);

        Map<String, Object> notification = authorLive.notifications.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        assertThat(notification).isNotNull()
                .containsEntry("type", "COLLAB_APPLICATION")
                .containsEntry("targetId", postId.toString());
        assertThat(notification.get("actor")).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("id", applicant.getId().toString());
        // Non anche NEW_MESSAGE (sezione 6.7) e nessuna notifica a chi si candida.
        assertThat(authorLive.notifications.poll(700, TimeUnit.MILLISECONDS)).isNull();
        assertThat(applicantLive.notifications.poll(700, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    void apply_withLongestTitleAndMessage_fitsTheChatMessageColumn() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID postId = openCollabPost(author);
        jdbc.update("update collab_posts set title = ? where id = ?", "T".repeat(150), postId);

        apply(applicant, postId, "{\"message\": \"" + "m".repeat(1800) + "\"}")
                .andExpect(status().isCreated());

        assertThat(messages.findAll().get(0).getBody()).hasSizeLessThanOrEqualTo(2000);
    }

    // ---- sblocco ----

    @Test
    void afterApplying_strangersWriteToEachOtherOverStomp() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID postId = openCollabPost(author);
        apply(applicant, postId, BODY).andExpect(status().isCreated());
        ChatConversation conversation = conversations.findAll().get(0);
        Live authorLive = live(author);
        Live applicantLive = live(applicant);

        // Uno alla volta, aspettando la consegna a entrambi: due invii insieme non hanno un ordine garantito.
        authorLive.connection.send(destination(conversation), Map.of("body", "ti rispondo"));
        assertThat(applicantLive.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("body", "ti rispondo");
        assertThat(authorLive.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("body", "ti rispondo");

        applicantLive.connection.send(destination(conversation), Map.of("body", "grazie"));
        assertThat(authorLive.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("body", "grazie");
        assertThat(authorLive.errors.poll(300, TimeUnit.MILLISECONDS)).isNull();
        assertThat(applicantLive.errors.poll(300, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    void postClosedAfterApplying_makesTheChatLocked_butHistoryStaysReadable() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID postId = openCollabPost(author);
        apply(applicant, postId, BODY).andExpect(status().isCreated());
        ChatConversation conversation = conversations.findAll().get(0);
        Live applicantLive = live(applicant);
        jdbc.update("update collab_posts set is_open = false where id = ?", postId);

        applicantLive.connection.send(destination(conversation), Map.of("body", "ci sei ancora?"));

        assertThat(applicantLive.errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("code", "CHAT_LOCKED");
        assertThat(messages.count()).isEqualTo(1);
        assertThat(applicantLive.connection.isConnected()).isTrue();
    }

    @Test
    void postDeletedAfterApplying_makesTheChatLocked() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID postId = openCollabPost(author);
        apply(applicant, postId, BODY).andExpect(status().isCreated());
        ChatConversation conversation = conversations.findAll().get(0);
        Live authorLive = live(author);
        hide("collab_posts", postId, author);

        authorLive.connection.send(destination(conversation), Map.of("body", "annuncio cancellato"));

        assertThat(authorLive.errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("code", "CHAT_LOCKED");
    }

    // ---- candidatura unica (decisione 99) ----

    @Test
    void secondApplicationToTheSamePost_returns409_andCreatesNoMessageNorNotification() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID postId = openCollabPost(author);
        apply(applicant, postId, BODY).andExpect(status().isCreated());

        apply(applicant, postId, BODY)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COLLAB_ALREADY_APPLIED"))
                .andExpect(jsonPath("$.message").value("Ti sei gia' candidato a questo annuncio"));

        assertThat(conversations.count()).isEqualTo(1);
        assertThat(messages.count()).isEqualTo(1);
        assertThat(notifications.count()).isEqualTo(1);
        assertThat(unlockRows(conversations.findAll().get(0))).isEqualTo(1);
    }

    @Test
    void applicationsFromAnotherUserOrToAnotherPost_stayAllowed() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        User other = user("altro@example.com", "Altro");
        UUID postId = openCollabPost(author);
        UUID otherPostId = openCollabPost(author);

        apply(applicant, postId, BODY).andExpect(status().isCreated());
        apply(other, postId, BODY).andExpect(status().isCreated());
        apply(applicant, otherPostId, BODY).andExpect(status().isCreated());

        assertThat(messages.count()).isEqualTo(3);
    }

    @Test
    void twoSimultaneousApplications_oneSucceedsAndTheOtherGets409() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID postId = openCollabPost(author);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<Integer>> results = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                results.add(pool.submit(() -> {
                    start.await();
                    return apply(applicant, postId, BODY).andReturn().getResponse().getStatus();
                }));
            }
            start.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> result : results) {
                statuses.add(result.get(30, TimeUnit.SECONDS));
            }

            // Mai un 500: la seconda richiesta perde la corsa e riceve l'errore previsto.
            assertThat(statuses).containsExactlyInAnyOrder(201, 409);
        } finally {
            pool.shutdownNow();
        }
        assertThat(messages.count()).isEqualTo(1);
        assertThat(notifications.count()).isEqualTo(1);
        assertThat(conversations.count()).isEqualTo(1);
    }

    @Test
    void closedPostWithAnExistingApplication_returnsCollabClosedBeforeAlreadyApplied() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID postId = openCollabPost(author);
        apply(applicant, postId, BODY).andExpect(status().isCreated());
        jdbc.update("update collab_posts set is_open = false where id = ?", postId);

        apply(applicant, postId, BODY)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COLLAB_CLOSED"));
    }

    @Test
    void duplicateApplications_doNotConsumeTheLimit() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID postId = openCollabPost(author);
        UUID otherPostId = openCollabPost(author);
        apply(applicant, postId, BODY).andExpect(status().isCreated());

        // Se il rifiuto consumasse il limite, la dodicesima richiesta sarebbe un 429.
        for (int i = 0; i < 11; i++) {
            apply(applicant, postId, BODY)
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("COLLAB_ALREADY_APPLIED"));
        }

        apply(applicant, otherPostId, BODY).andExpect(status().isCreated());
    }

    // ---- controlli ----

    @Test
    void closedPost_returns409CollabClosed_andCreatesNothing() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID postId = openCollabPost(author);
        jdbc.update("update collab_posts set is_open = false where id = ?", postId);

        apply(applicant, postId, BODY)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COLLAB_CLOSED"));

        assertThat(conversations.count()).isZero();
        assertThat(messages.count()).isZero();
    }

    @Test
    void ownPost_returns400CannotApplyOwnPost() throws Exception {
        User author = user("autore@example.com", "Autore");
        UUID postId = openCollabPost(author);

        apply(author, postId, BODY)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CANNOT_APPLY_OWN_POST"));

        assertThat(conversations.count()).isZero();
    }

    @Test
    void unknownOrHiddenPost_returns404() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID hiddenId = openCollabPost(author);
        hide("collab_posts", hiddenId, author);

        apply(applicant, UUID.randomUUID(), BODY).andExpect(status().isNotFound());
        apply(applicant, hiddenId, BODY)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void suspendedAuthor_makesThePostNotFound_withoutRevealingTheSuspension() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID postId = openCollabPost(author);
        suspended(author, applicant);

        apply(applicant, postId, BODY)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Annuncio non trovato"));

        assertThat(messages.count()).isZero();
    }

    @Test
    void withoutToken_returns401() throws Exception {
        UUID postId = openCollabPost(user("autore@example.com", "Autore"));

        mockMvc.perform(post("/api/collab-posts/{id}/applications", postId)
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidMessage_returns400WithFieldError() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID postId = openCollabPost(author);

        for (String body : new String[]{
                "{\"message\": \"\"}", "{\"message\": \"   \"}", "{}",
                "{\"message\": \"" + "m".repeat(1801) + "\"}"}) {
            apply(applicant, postId, body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.fields.message").exists());
        }
        assertThat(messages.count()).isZero();
    }

    // ---- limite ----

    @Test
    void eleventhApplicationInADay_returns429() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        // Una sola candidatura per annuncio: il limite si raggiunge con annunci diversi.
        for (int i = 0; i < 10; i++) {
            apply(applicant, openCollabPost(author), BODY).andExpect(status().isCreated());
        }

        apply(applicant, openCollabPost(author), BODY)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));
        assertThat(messages.count()).isEqualTo(10);
    }

    @Test
    void rejectedApplications_doNotConsumeTheLimit() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID closedId = openCollabPost(author);
        jdbc.update("update collab_posts set is_open = false where id = ?", closedId);
        UUID openId = openCollabPost(author);

        for (int i = 0; i < 11; i++) {
            apply(applicant, closedId, BODY).andExpect(status().isConflict());
        }

        apply(applicant, openId, BODY).andExpect(status().isCreated());
    }

    // ---- helper ----

    private ResultActions apply(User user, UUID postId, String json) throws Exception {
        return mockMvc.perform(post("/api/collab-posts/{id}/applications", postId)
                .header("Authorization", bearer(user)).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private int unlockRows(ChatConversation conversation) {
        return jdbc.queryForObject("select count(*) from chat_unlocks where conversation_id = ?",
                Integer.class, conversation.getId());
    }

    private String destination(ChatConversation conversation) {
        return "/app/chats/" + conversation.getId() + "/send";
    }

    /** Connessione di un utente con le code di messaggi, notifiche ed errori gia' attive. */
    private Live live(User user) throws Exception {
        Connection connection = stomp.connect(accessTokens.issue(user.getId()).token());
        assertThat(connection.isConnected()).isTrue();
        BlockingQueue<Map<String, Object>> errors = connection.subscribe("/user/queue/errors", user.getId());
        BlockingQueue<Map<String, Object>> received = connection.subscribe("/user/queue/messages", user.getId());
        BlockingQueue<Map<String, Object>> notifications =
                connection.subscribe("/user/queue/notifications", user.getId());
        return new Live(connection, received, notifications, errors);
    }

    private record Live(Connection connection, BlockingQueue<Map<String, Object>> messages,
                        BlockingQueue<Map<String, Object>> notifications,
                        BlockingQueue<Map<String, Object>> errors) {
    }
}

package it.epicode.resonance.notification;

import it.epicode.resonance.chat.ChatConversation;
import it.epicode.resonance.chat.ChatTestSupport;
import it.epicode.resonance.feed.FeedPost;
import it.epicode.resonance.feed.FeedPostRepository;
import it.epicode.resonance.feed.FeedService;
import it.epicode.resonance.feed.PostLikeRepository;
import it.epicode.resonance.support.StompTestClient;
import it.epicode.resonance.support.StompTestClient.Connection;
import it.epicode.resonance.user.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Notifiche live su {@code /user/queue/notifications} (progettazione, sezioni 7.4 e 7.6) con veri client STOMP:
 * NEW_LIKE e NEW_MESSAGE arrivano solo al destinatario, mai a chi le provoca, e solo dopo il commit (se la
 * transazione fallisce non parte nulla).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class LiveNotificationIntegrationTest extends ChatTestSupport {

    /** Attesa breve per le consegne che NON devono avvenire. */
    private static final long QUIET_MILLIS = 700;

    @LocalServerPort
    private int port;

    @Autowired
    private SimpMessagingTemplate template;

    @Autowired
    private FeedPostRepository feedPosts;

    @Autowired
    private PostLikeRepository likes;

    @Autowired
    private FeedService feedService;

    @Autowired
    private NotificationRepository savedNotifications;

    @Autowired
    private FailAfterNotification failAfterNotification;

    private StompTestClient stomp;

    /** Bean di prova: dopo la pubblicazione dell'evento, se armato, fa fallire la transazione del chiamante. */
    @TestConfiguration
    static class ProbeConfig {
        @Bean
        FailAfterNotification failAfterNotification() {
            return new FailAfterNotification();
        }
    }

    static class FailAfterNotification {
        final AtomicBoolean armed = new AtomicBoolean();

        /** Listener sincrono: gira dentro la transazione che ha pubblicato l'evento, quindi la annulla. */
        @EventListener
        void onNotification(LiveNotificationEvent event) {
            if (armed.get()) {
                throw new IllegalStateException("errore forzato dopo la pubblicazione");
            }
        }
    }

    @BeforeEach
    void openClient() {
        stomp = new StompTestClient(port, template);
        failAfterNotification.armed.set(false);
    }

    @AfterEach
    void closeClient() {
        stomp.close();
    }

    // ---- NEW_LIKE ----

    @Test
    void like_notifiesTheConnectedAuthor() throws Exception {
        User author = user("autore@example.com", "Autore");
        User fan = user("fan@example.com", "Fan");
        FeedPost post = feedPosts.saveAndFlush(new FeedPost(author, "primo post"));
        BlockingQueue<Map<String, Object>> notifications = notificationsOf(author);

        mockMvc.perform(put("/api/feed-posts/{id}/like", post.getId()).header("Authorization", bearer(fan)))
                .andExpect(status().isOk());

        Map<String, Object> notification = notifications.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        assertThat(notification).isNotNull()
                .containsEntry("type", "NEW_LIKE")
                .containsEntry("targetId", post.getId().toString())
                .containsKey("createdAt");
        // Il frontend unisce la live all'elenco salvato per id (decisione 97).
        assertThat(notification.get("id")).isEqualTo(onlySavedNotification().getId().toString());
        assertThat(notification.get("preview")).isNull();
        assertThat(notification.get("actor")).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("id", fan.getId().toString())
                .containsEntry("displayName", "Fan")
                .doesNotContainKey("email");
    }

    @Test
    void ownLike_doesNotNotify() throws Exception {
        User author = user("autore@example.com", "Autore");
        FeedPost post = feedPosts.saveAndFlush(new FeedPost(author, "primo post"));
        BlockingQueue<Map<String, Object>> notifications = notificationsOf(author);

        mockMvc.perform(put("/api/feed-posts/{id}/like", post.getId()).header("Authorization", bearer(author)))
                .andExpect(status().isOk());

        assertThat(notifications.poll(QUIET_MILLIS, TimeUnit.MILLISECONDS)).isNull();
        assertThat(likes.count()).isEqualTo(1);
    }

    @Test
    void secondLike_isIdempotentAndDoesNotNotifyAgain() throws Exception {
        User author = user("autore@example.com", "Autore");
        User fan = user("fan@example.com", "Fan");
        FeedPost post = feedPosts.saveAndFlush(new FeedPost(author, "primo post"));
        BlockingQueue<Map<String, Object>> notifications = notificationsOf(author);

        for (int i = 0; i < 2; i++) {
            mockMvc.perform(put("/api/feed-posts/{id}/like", post.getId()).header("Authorization", bearer(fan)))
                    .andExpect(status().isOk());
        }

        assertThat(notifications.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS)).isNotNull();
        assertThat(notifications.poll(QUIET_MILLIS, TimeUnit.MILLISECONDS)).isNull();
    }

    // ---- amicizie ----

    @Test
    void friendRequest_notifiesTheAddresseeLive_withTheSavedId() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        BlockingQueue<Map<String, Object>> toAddressee = notificationsOf(b);
        BlockingQueue<Map<String, Object>> toRequester = notificationsOf(a);

        mockMvc.perform(post("/api/friendships").header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"userId\": \"" + b.getId() + "\"}"))
                .andExpect(status().isCreated());

        Map<String, Object> notification = toAddressee.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        assertThat(notification).isNotNull()
                .containsEntry("type", "FRIEND_REQUEST")
                .containsEntry("targetId", friendships.findAll().get(0).getId().toString());
        assertThat(notification.get("id")).isEqualTo(onlySavedNotification().getId().toString());
        assertThat(notification.get("actor")).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("id", a.getId().toString());
        // Chi chiede non riceve niente.
        assertThat(toRequester.poll(QUIET_MILLIS, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    void accept_notifiesTheRequesterLive_withTheSavedId() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        mockMvc.perform(post("/api/friendships").header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"userId\": \"" + b.getId() + "\"}"))
                .andExpect(status().isCreated());
        BlockingQueue<Map<String, Object>> toRequester = notificationsOf(a);

        mockMvc.perform(post("/api/friendships/{id}/accept", friendships.findAll().get(0).getId())
                        .header("Authorization", bearer(b)))
                .andExpect(status().isOk());

        Map<String, Object> notification = toRequester.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        assertThat(notification).isNotNull().containsEntry("type", "FRIEND_ACCEPTED");
        Notification accepted = savedNotifications.findAll().stream()
                .filter(n -> n.getType() == NotificationType.FRIEND_ACCEPTED).findFirst().orElseThrow();
        assertThat(notification.get("id")).isEqualTo(accepted.getId().toString());
        assertThat(notification.get("actor")).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("id", b.getId().toString());
    }

    // ---- NEW_MESSAGE ----

    @Test
    void message_notifiesOnlyTheRecipient_withPreviewOfAtMost100Characters() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        befriend(a, b);
        ChatConversation conversation = conversation(a, b);
        BlockingQueue<Map<String, Object>> toSender = notificationsOf(a);
        BlockingQueue<Map<String, Object>> toRecipient = notificationsOf(b);
        Connection sender = connectedWithMessages(a);

        sender.send("/app/chats/" + conversation.getId() + "/send", Map.of("body", "x".repeat(150)));

        Map<String, Object> notification = toRecipient.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        assertThat(notification).isNotNull()
                .containsEntry("type", "NEW_MESSAGE")
                .containsEntry("targetId", conversation.getId().toString());
        assertThat(notification.get("preview")).isEqualTo("x".repeat(100));
        // NEW_MESSAGE non e' salvato (decisione 97): nessun id.
        assertThat(notification.get("id")).isNull();
        assertThat(notification.get("actor")).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("id", a.getId().toString());
        // Chi scrive non riceve la notifica del proprio messaggio.
        assertThat(toSender.poll(QUIET_MILLIS, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    void preview_neverSplitsAnEmoji() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        befriend(a, b);
        ChatConversation conversation = conversation(a, b);
        BlockingQueue<Map<String, Object>> toRecipient = notificationsOf(b);
        Connection sender = connectedWithMessages(a);
        // 101 emoji: ognuna e' una coppia di unita' UTF-16, il taglio per punti di codice non la spezza.
        String body = "🎸".repeat(101);

        sender.send("/app/chats/" + conversation.getId() + "/send", Map.of("body", body));

        Map<String, Object> notification = toRecipient.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        assertThat(notification).isNotNull();
        assertThat(notification.get("preview")).isEqualTo("🎸".repeat(100));
    }

    // ---- consegna solo dopo il commit ----

    @Test
    void failureAfterPublishing_rollsBackAndNothingIsDelivered() throws Exception {
        User author = user("autore@example.com", "Autore");
        User fan = user("fan@example.com", "Fan");
        FeedPost post = feedPosts.saveAndFlush(new FeedPost(author, "primo post"));
        BlockingQueue<Map<String, Object>> notifications = notificationsOf(author);
        failAfterNotification.armed.set(true);

        assertThatThrownBy(() -> feedService.like(post.getId(), fan.getId()))
                .isInstanceOf(IllegalStateException.class);

        // Il listener AFTER_COMMIT non e' mai partito e il like non e' stato salvato.
        assertThat(notifications.poll(2, TimeUnit.SECONDS)).isNull();
        assertThat(likes.count()).isZero();
    }

    // ---- helper ----

    private Notification onlySavedNotification() {
        assertThat(savedNotifications.count()).isEqualTo(1);
        return savedNotifications.findAll().get(0);
    }

    /** Connessione dell'utente con la sola coda delle notifiche attiva. */
    private BlockingQueue<Map<String, Object>> notificationsOf(User user) throws Exception {
        Connection connection = stomp.connect(accessTokens.issue(user.getId()).token());
        assertThat(connection.isConnected()).isTrue();
        return connection.subscribe("/user/queue/notifications", user.getId());
    }

    /** Connessione dell'utente che scrive: serve solo per inviare. */
    private Connection connectedWithMessages(User user) throws Exception {
        Connection connection = stomp.connect(accessTokens.issue(user.getId()).token());
        assertThat(connection.isConnected()).isTrue();
        connection.subscribe("/user/queue/messages", user.getId());
        return connection;
    }
}

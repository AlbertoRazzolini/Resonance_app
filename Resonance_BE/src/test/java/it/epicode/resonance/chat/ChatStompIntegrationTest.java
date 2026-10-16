package it.epicode.resonance.chat;

import it.epicode.resonance.support.StompTestClient;
import it.epicode.resonance.support.StompTestClient.Connection;
import it.epicode.resonance.user.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Invio dei messaggi su STOMP (progettazione, sezioni 7.4-7.7) con veri client sul server su porta casuale:
 * consegna a mittente e destinatario dopo il commit, l'ordine dei controlli token, limite, body, appartenenza e
 * permesso, e gli errori che arrivano solo alla sessione che ha inviato con la connessione aperta.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ChatStompIntegrationTest extends ChatTestSupport {

    @LocalServerPort
    private int port;

    @Autowired
    private SimpMessagingTemplate template;

    private StompTestClient stomp;

    @BeforeEach
    void openClient() {
        stomp = new StompTestClient(port, template);
    }

    @AfterEach
    void closeClient() {
        stomp.close();
    }

    // ---- consegna ----

    @Test
    void messageBetweenFriends_isDeliveredToBothAndSaved() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        befriend(a, b);
        ChatConversation conversation = conversation(a, b);
        Session sender = session(a);
        Session recipient = session(b);

        sender.connection.send(destination(conversation), Map.of("body", "ciao Bruno"));

        Map<String, Object> toRecipient = recipient.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        Map<String, Object> toSender = sender.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        assertThat(toRecipient).isNotNull().containsEntry("body", "ciao Bruno")
                .containsEntry("senderId", a.getId().toString())
                .containsEntry("conversationId", conversation.getId().toString())
                .containsKeys("id", "sentAt", "readAt");
        assertThat(toRecipient.get("readAt")).isNull();
        assertThat(toSender).isEqualTo(toRecipient);
        assertThat(messages.count()).isEqualTo(1);
        // last_message_at aggiornato: ordina la lista delle conversazioni.
        assertThat(conversations.findById(conversation.getId()).orElseThrow().getLastMessageAt()).isNotNull();
    }

    @Test
    void message_isNotDeliveredToAThirdUser() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        User c = user("c@example.com", "Carla");
        befriend(a, b);
        ChatConversation conversation = conversation(a, b);
        Session sender = session(a);
        Session recipient = session(b);
        Session third = session(c);

        sender.connection.send(destination(conversation), Map.of("body", "riservato"));

        assertThat(recipient.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS)).isNotNull();
        assertThat(third.messages.poll(500, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    void unlockedConversationBetweenStrangers_acceptsMessages() throws Exception {
        User musician = user("m@example.com", "Musicista");
        User applicant = user("c@example.com", "Candidato");
        ChatConversation conversation = conversation(musician, applicant);
        chatService.unlock(conversation, ChatUnlockSource.COLLAB_POST, openCollabPost(musician));
        Session sender = session(applicant);
        Session recipient = session(musician);

        sender.connection.send(destination(conversation), Map.of("body", "mi candido"));

        assertThat(recipient.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("body", "mi candido");
    }

    // ---- ordine dei controlli ----

    @Test
    void expiredToken_isCheckedBeforeBody() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        befriend(a, b);
        ChatConversation conversation = conversation(a, b);
        Session sender = session(a);
        clock.advance(Duration.ofMinutes(16));

        // Body vuoto E token scaduto: vince il token.
        sender.connection.send(destination(conversation), Map.of("body", ""));

        assertThat(sender.errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("code", "TOKEN_INVALID");
        assertThat(messages.count()).isZero();
    }

    @Test
    void rateLimit_isCheckedBeforeBody_andThirtyFirstMessageInAMinuteIsRejected() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        befriend(a, b);
        ChatConversation conversation = conversation(a, b);
        Session sender = session(a);
        Session recipient = session(b);

        for (int i = 1; i <= 30; i++) {
            sender.connection.send(destination(conversation), Map.of("body", "m" + i));
        }
        for (int i = 1; i <= 30; i++) {
            assertThat(recipient.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS)).isNotNull();
        }
        // Il 31esimo ha anche il body vuoto: vince il limite, che viene prima della validazione.
        sender.connection.send(destination(conversation), Map.of("body", ""));

        assertThat(sender.errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("code", "TOO_MANY_REQUESTS");
        assertThat(messages.count()).isEqualTo(30);

        // Passata la finestra si puo' scrivere di nuovo, a connessione ancora aperta.
        clock.advance(Duration.ofSeconds(61));
        // Il token dura 15 minuti: servono un token nuovo e una connessione nuova solo oltre quel limite.
        sender.connection.send(destination(conversation), Map.of("body", "di nuovo"));
        assertThat(recipient.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("body", "di nuovo");
    }

    @Test
    void invalidBody_returnsValidationErrorAndSavesNothing() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        befriend(a, b);
        ChatConversation conversation = conversation(a, b);
        Session sender = session(a);

        sender.connection.send(destination(conversation), Map.of("body", ""));
        sender.connection.send(destination(conversation), Map.of("body", "   "));
        sender.connection.send(destination(conversation), Map.of("body", "x".repeat(2001)));
        sender.connection.send(destination(conversation), Map.of());

        for (int i = 0; i < 4; i++) {
            assertThat(sender.errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                    .containsEntry("code", "VALIDATION_ERROR");
        }
        assertThat(messages.count()).isZero();
        assertThat(sender.connection.isConnected()).isTrue();
    }

    @Test
    void nonMember_getsNotConversationMember_beforeAnyPermissionCheck() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        User intruder = user("i@example.com", "Intruso");
        befriend(a, b);
        // Anche se l'intruso fosse amico di uno dei due, la conversazione non e' sua.
        befriend(intruder, a);
        ChatConversation conversation = conversation(a, b);
        Session recipient = session(b);
        Session attacker = session(intruder);

        attacker.connection.send(destination(conversation), Map.of("body", "mi infilo"));

        assertThat(attacker.errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("code", "NOT_CONVERSATION_MEMBER");
        assertThat(recipient.messages.poll(500, TimeUnit.MILLISECONDS)).isNull();
        assertThat(messages.count()).isZero();
        assertThat(attacker.connection.isConnected()).isTrue();
    }

    @Test
    void unknownConversation_returnsNotFound() throws Exception {
        User a = user("a@example.com", "Alice");
        Session sender = session(a);

        sender.connection.send("/app/chats/" + UUID.randomUUID() + "/send", Map.of("body", "ciao"));

        assertThat(sender.errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("code", "NOT_FOUND");
    }

    // ---- permesso di scrittura ----

    @Test
    void afterFriendshipRemoved_sendIsChatLocked_withConnectionOpenAndHistoryIntact() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        var friendship = befriend(a, b);
        ChatConversation conversation = conversation(a, b);
        Session sender = session(a);
        Session recipient = session(b);
        sender.connection.send(destination(conversation), Map.of("body", "prima"));
        assertThat(recipient.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS)).isNotNull();
        friendships.delete(friendship);

        sender.connection.send(destination(conversation), Map.of("body", "dopo"));

        Map<String, Object> error = sender.errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        assertThat(error).containsEntry("code", "CHAT_LOCKED");
        assertThat(recipient.messages.poll(500, TimeUnit.MILLISECONDS)).isNull();
        assertThat(messages.count()).isEqualTo(1);
        assertThat(sender.connection.isConnected()).isTrue();
    }

    @Test
    void strangersWithoutUnlock_getChatLocked() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        ChatConversation conversation = conversation(a, b);
        Session sender = session(a);

        sender.connection.send(destination(conversation), Map.of("body", "ciao"));

        assertThat(sender.errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("code", "CHAT_LOCKED");
        assertThat(messages.count()).isZero();
    }

    @Test
    void suspendedRecipient_getsGenericChatLocked_withoutRevealingTheSuspension() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        befriend(a, b);
        ChatConversation conversation = conversation(a, b);
        Session sender = session(a);
        suspended(b, a);

        sender.connection.send(destination(conversation), Map.of("body", "ci sei?"));

        Map<String, Object> error = sender.errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        assertThat(error).containsEntry("code", "CHAT_LOCKED");
        assertThat(error.get("message").toString().toLowerCase()).doesNotContain("sospes");
        assertThat(messages.count()).isZero();
    }

    @Test
    void suspendedSender_withTheConnectionStillOpen_isRejected() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        befriend(a, b);
        ChatConversation conversation = conversation(a, b);
        Session sender = session(a);
        suspended(a, b);

        sender.connection.send(destination(conversation), Map.of("body", "sono sospeso"));

        // Difesa aggiuntiva alla chiusura delle sessioni: il controllo del token ripetuto a ogni invio.
        Map<String, Object> error = sender.errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        assertThat(error).containsEntry("code", "ACCOUNT_SUSPENDED");
        assertThat(messages.count()).isZero();
    }

    // ---- helper ----

    private String destination(ChatConversation conversation) {
        return "/app/chats/" + conversation.getId() + "/send";
    }

    /** Connessione di un utente con le code dei messaggi e degli errori gia' attive. */
    private Session session(User user) throws Exception {
        Connection connection = stomp.connect(accessTokens.issue(user.getId()).token());
        assertThat(connection.isConnected()).isTrue();
        BlockingQueue<Map<String, Object>> errors = connection.subscribe("/user/queue/errors", user.getId());
        BlockingQueue<Map<String, Object>> received = connection.subscribe("/user/queue/messages", user.getId());
        return new Session(connection, received, errors);
    }

    private record Session(Connection connection, BlockingQueue<Map<String, Object>> messages,
                           BlockingQueue<Map<String, Object>> errors) {
    }
}

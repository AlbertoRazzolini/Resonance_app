package it.epicode.resonance.websocket;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.support.StompTestClient;
import it.epicode.resonance.support.StompTestClient.Connection;
import it.epicode.resonance.support.StompTestClient.Frame;
import it.epicode.resonance.support.StompTestController;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Sicurezza del WebSocket STOMP (progettazione, sezioni 7.2 e 7.3) con veri client sul server su porta
 * casuale: CONNECT accettato solo con un token valido di un utente attivo, SEND solo verso /app/**,
 * SUBSCRIBE solo verso le tre code dell'utente, e nessun errore che riveli dettagli interni.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(StompTestController.class)
class WebSocketSecurityTest extends IntegrationTest {

    private static final String GENERIC_TOKEN_MESSAGE = "Token mancante, scaduto o non valido";

    @LocalServerPort
    private int port;

    @Autowired
    private SimpMessagingTemplate template;

    @Autowired
    private AccessTokenService accessTokens;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    private StompTestClient stomp;

    @BeforeEach
    void openClient() {
        stomp = new StompTestClient(port, template);
    }

    @AfterEach
    void closeClient() {
        stomp.close();
    }

    // ---------------------------------------------------------------- CONNECT

    @Test
    void connect_withoutToken_isRejectedWithTokenInvalid() throws Exception {
        Connection connection = stomp.connect(null);

        assertTokenInvalid(connection);
    }

    @Test
    void connect_withGarbageToken_isRejectedWithTokenInvalid() throws Exception {
        Connection connection = stomp.connect("non-e-un-jwt");

        assertTokenInvalid(connection);
    }

    @Test
    void connect_withExpiredToken_isRejectedWithTokenInvalid() throws Exception {
        User user = activeUser();
        String token = token(user);
        clock.advance(Duration.ofMinutes(16));

        Connection connection = stomp.connect(token);

        assertTokenInvalid(connection);
    }

    @Test
    void connect_withTokenOfUnknownUser_isRejectedWithTokenInvalid() throws Exception {
        Connection connection = stomp.connect(accessTokens.issue(UUID.randomUUID()).token());

        assertTokenInvalid(connection);
    }

    @Test
    void connect_withUnverifiedEmail_isRejectedWithTokenInvalid() throws Exception {
        User user = activeUser();
        user.setEmailVerified(false);
        users.save(user);

        Connection connection = stomp.connect(token(user));

        // Stesso codice dell'utente inesistente: non si rivela lo stato dell'account (decisione 65).
        assertTokenInvalid(connection);
    }

    @Test
    void connect_withSuspendedUser_isRejectedWithAccountSuspended() throws Exception {
        User admin = activeUser();
        User user = activeUser();
        user.setStatus(UserStatus.SUSPENDED);
        user.setSuspendedAt(clock.instant());
        user.setSuspendedBy(admin.getId());
        user.setSuspensionReason("Motivo riservato");
        users.save(user);

        Connection connection = stomp.connect(token(user));

        Frame frame = connection.awaitErrorFrame();
        assertThat(frame).isNotNull();
        assertThat(frame.message()).isEqualTo("ACCOUNT_SUSPENDED");
        assertThat(frame.body()).containsEntry("code", "ACCOUNT_SUSPENDED");
        // Il motivo della sospensione non passa dal WebSocket.
        assertThat(frame.body().toString()).doesNotContain("Motivo riservato");
        assertThat(connection.isConnected()).isFalse();
    }

    @Test
    void connect_withValidToken_connects() throws Exception {
        User user = activeUser();

        Connection connection = stomp.connect(token(user));

        assertThat(connection.isConnected()).isTrue();
    }

    @Test
    void sendBeforeConnect_isRejectedWithTokenInvalid() throws Exception {
        // Un client STOMP non manda mai un SEND prima del CONNECT: il frame si scrive a mano.
        String response = stomp.rawExchange("SEND\ndestination:/app/test/echo\n\n\u0000");

        assertThat(response).startsWith("ERROR").contains("message:TOKEN_INVALID");
    }

    @Test
    void subscribeBeforeConnect_isRejectedWithTokenInvalid() throws Exception {
        String response = stomp.rawExchange("SUBSCRIBE\nid:sub-0\ndestination:/user/queue/messages\n\n\u0000");

        assertThat(response).startsWith("ERROR").contains("message:TOKEN_INVALID");
    }

    // ---------------------------------------------------------------- SUBSCRIBE

    @Test
    void subscribe_toAnotherUsersQueue_isDeniedAndConnectionStaysOpen() throws Exception {
        User user = activeUser();
        User other = activeUser();
        Connection connection = stomp.connect(token(user));
        BlockingQueue<Map<String, Object>> errors = connection.subscribe("/user/queue/errors", user.getId());

        connection.subscribeWithoutWaiting("/user/" + other.getId() + "/queue/messages");

        Map<String, Object> error = errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        assertThat(error).containsEntry("code", "ACCESS_DENIED");
        // Il messaggio non ripete la destinazione richiesta.
        assertThat(error.get("message").toString()).doesNotContain(other.getId().toString());
        assertThat(connection.isConnected()).isTrue();
    }

    @Test
    void subscribe_toUnlistedDestinations_isDenied() throws Exception {
        User user = activeUser();
        Connection connection = stomp.connect(token(user));
        BlockingQueue<Map<String, Object>> errors = connection.subscribe("/user/queue/errors", user.getId());

        // Fuori dalle tre code dell'utente: topic, coda del broker senza /user, coda utente inesistente.
        connection.subscribeWithoutWaiting("/topic/chat");
        connection.subscribeWithoutWaiting("/queue/messages");
        connection.subscribeWithoutWaiting("/user/queue/altro");

        for (int i = 0; i < 3; i++) {
            assertThat(errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                    .containsEntry("code", "ACCESS_DENIED");
        }
        assertThat(connection.isConnected()).isTrue();
    }

    @Test
    void subscribe_toOwnQueues_isAllowed() throws Exception {
        User user = activeUser();
        Connection connection = stomp.connect(token(user));

        // subscribe() fallisce se la coda non diventa attiva.
        connection.subscribe("/user/queue/errors", user.getId());
        connection.subscribe("/user/queue/messages", user.getId());
        connection.subscribe("/user/queue/notifications", user.getId());

        assertThat(connection.isConnected()).isTrue();
    }

    // ---------------------------------------------------------------- SEND

    @Test
    void send_toBrokerQueue_isDeniedAndNothingIsDelivered() throws Exception {
        User user = activeUser();
        User victim = activeUser();
        Connection attacker = stomp.connect(token(user));
        Connection victimConnection = stomp.connect(token(victim));
        BlockingQueue<Map<String, Object>> errors = attacker.subscribe("/user/queue/errors", user.getId());
        BlockingQueue<Map<String, Object>> victimMessages =
                victimConnection.subscribe("/user/queue/messages", victim.getId());

        // Senza il filtro, un SEND verso la coda di un altro utente gli recapiterebbe un messaggio falso.
        attacker.send("/queue/x", Map.of("body", "falso"));
        attacker.send("/user/" + victim.getId() + "/queue/messages", Map.of("body", "falso"));

        for (int i = 0; i < 2; i++) {
            assertThat(errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                    .containsEntry("code", "ACCESS_DENIED");
        }
        assertThat(victimMessages.poll(500, TimeUnit.MILLISECONDS)).isNull();
        assertThat(attacker.isConnected()).isTrue();
    }

    @Test
    void send_toAppDestination_reachesTheController() throws Exception {
        User user = activeUser();
        Connection connection = stomp.connect(token(user));
        BlockingQueue<Map<String, Object>> messages = connection.subscribe("/user/queue/messages", user.getId());

        connection.send("/app/test/echo", Map.of("body", "ciao"));

        assertThat(messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS)).containsEntry("body", "ciao");
    }

    // ---------------------------------------------------------------- errori dei controller

    @Test
    void controllerAppException_goesToTheSendersErrorQueueOnly() throws Exception {
        User user = activeUser();
        User other = activeUser();
        Connection connection = stomp.connect(token(user));
        Connection otherConnection = stomp.connect(token(other));
        BlockingQueue<Map<String, Object>> errors = connection.subscribe("/user/queue/errors", user.getId());
        BlockingQueue<Map<String, Object>> otherErrors = otherConnection.subscribe("/user/queue/errors", other.getId());

        connection.send("/app/test/denied", Map.of());

        assertThat(errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("code", "ACCESS_DENIED");
        assertThat(otherErrors.poll(500, TimeUnit.MILLISECONDS)).isNull();
        assertThat(connection.isConnected()).isTrue();
    }

    @Test
    void controllerUnexpectedException_returnsGenericInternalError() throws Exception {
        User user = activeUser();
        Connection connection = stomp.connect(token(user));
        BlockingQueue<Map<String, Object>> errors = connection.subscribe("/user/queue/errors", user.getId());

        connection.send("/app/test/boom", Map.of());

        Map<String, Object> error = errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        assertThat(error).containsEntry("code", "INTERNAL_ERROR");
        // Mai il testo dell'eccezione ne' nomi di classi.
        assertThat(error.toString()).doesNotContain(StompTestController.SECRET_DETAIL)
                .doesNotContain("IllegalStateException");
        assertThat(connection.isConnected()).isTrue();
    }

    // ---------------------------------------------------------------- supporto

    private void assertTokenInvalid(Connection connection) throws InterruptedException {
        Frame frame = connection.awaitErrorFrame();
        assertThat(frame).as("frame ERROR").isNotNull();
        assertThat(frame.message()).isEqualTo("TOKEN_INVALID");
        assertThat(frame.body())
                .containsEntry("code", "TOKEN_INVALID")
                .containsEntry("message", GENERIC_TOKEN_MESSAGE);
        assertThat(connection.isConnected()).isFalse();
    }

    private String token(User user) {
        return accessTokens.issue(user.getId()).token();
    }

    private User activeUser() {
        User user = new User("utente-" + UUID.randomUUID() + "@example.com", "non-usata", "Utente");
        user.setEmailVerified(true);
        users.save(user);
        roles.save(new UserRole(user.getId(), Role.FAN));
        return user;
    }
}

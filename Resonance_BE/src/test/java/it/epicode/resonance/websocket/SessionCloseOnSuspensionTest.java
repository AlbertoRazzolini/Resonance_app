package it.epicode.resonance.websocket;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.support.StompTestClient;
import it.epicode.resonance.support.StompTestClient.Connection;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Chiusura delle sessioni WebSocket alla sospensione (progettazione, sezione 7.8): l'admin sospende via REST
 * e le sessioni aperte dell'utente ricevono ACCOUNT_SUSPENDED e vengono chiuse; le altre restano aperte e il
 * nuovo CONNECT dell'utente sospeso e' respinto.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SessionCloseOnSuspensionTest extends IntegrationTest {

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

    @Autowired
    private WebSocketSessionRegistry registry;

    private StompTestClient stomp;

    @BeforeEach
    void openClient() {
        stomp = new StompTestClient(port, template);
    }

    @AfterEach
    void closeClient() {
        stomp.close();
    }

    @Test
    void suspension_notifiesAndClosesAllOpenSessionsOfTheUser() throws Exception {
        User admin = user(Role.ADMIN);
        User target = user();
        // Due sessioni dello stesso utente (per esempio due schede del browser).
        Connection first = stomp.connect(token(target));
        Connection second = stomp.connect(token(target));
        BlockingQueue<Map<String, Object>> firstErrors = first.subscribe("/user/queue/errors", target.getId());
        BlockingQueue<Map<String, Object>> secondErrors = second.subscribe("/user/queue/errors", target.getId());

        suspend(admin, target);

        assertThat(awaitCode(firstErrors, "ACCOUNT_SUSPENDED")).isTrue();
        assertThat(awaitCode(secondErrors, "ACCOUNT_SUSPENDED")).isTrue();
        assertThat(first.awaitClosed()).isTrue();
        assertThat(second.awaitClosed()).isTrue();
    }

    @Test
    void suspension_leavesTheSessionsOfOtherUsersOpen() throws Exception {
        User admin = user(Role.ADMIN);
        User target = user();
        User bystander = user();
        Connection targetConnection = stomp.connect(token(target));
        Connection bystanderConnection = stomp.connect(token(bystander));
        BlockingQueue<Map<String, Object>> bystanderErrors =
                bystanderConnection.subscribe("/user/queue/errors", bystander.getId());

        suspend(admin, target);

        assertThat(targetConnection.awaitClosed()).isTrue();
        assertThat(bystanderErrors.poll(500, TimeUnit.MILLISECONDS)).isNull();
        assertThat(bystanderConnection.isConnected()).isTrue();
    }

    @Test
    void suspendedUser_cannotConnectAgain() throws Exception {
        User admin = user(Role.ADMIN);
        User target = user();
        String token = token(target);
        Connection connection = stomp.connect(token);
        suspend(admin, target);
        assertThat(connection.awaitClosed()).isTrue();

        Connection retry = stomp.connect(token);

        assertThat(retry.awaitErrorFrame().message()).isEqualTo("ACCOUNT_SUSPENDED");
        assertThat(retry.isConnected()).isFalse();
    }

    @Test
    void closedSessions_areRemovedFromTheRegistry() throws Exception {
        User user = user();
        Connection connection = stomp.connect(token(user));
        awaitSessionCount(user, 1);

        stomp.close();

        assertThat(connection.awaitClosed()).isTrue();
        awaitSessionCount(user, 0);
    }

    // ---------------------------------------------------------------- supporto

    /**
     * Cerca un errore con quel codice nella coda. Il secondo subscribe() manda messaggi di controllo a tutte
     * le sessioni dell'utente, quindi la prima sessione ne trova alcuni prima dell'errore vero.
     */
    private boolean awaitCode(BlockingQueue<Map<String, Object>> queue, String code) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(StompTestClient.WAIT_SECONDS);
        while (System.nanoTime() < deadline) {
            Map<String, Object> message = queue.poll(100, TimeUnit.MILLISECONDS);
            if (message != null && code.equals(message.get("code"))) {
                return true;
            }
        }
        return false;
    }

    private void awaitSessionCount(User user, int expected) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(StompTestClient.WAIT_SECONDS);
        while (registry.sessionCount(user.getId()) != expected && System.nanoTime() < deadline) {
            Thread.sleep(20);
        }
        assertThat(registry.sessionCount(user.getId())).isEqualTo(expected);
    }

    private void suspend(User admin, User target) throws Exception {
        mockMvc.perform(post("/api/admin/users/{id}/suspension", target.getId())
                        .header("Authorization", "Bearer " + token(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Linguaggio offensivo\"}"))
                .andExpect(status().isOk());
    }

    private String token(User user) {
        return accessTokens.issue(user.getId()).token();
    }

    private User user(Role... extraRoles) {
        User user = new User("utente-" + UUID.randomUUID() + "@example.com", "non-usata", "Utente " + UUID.randomUUID());
        user.setEmailVerified(true);
        users.save(user);
        roles.save(new UserRole(user.getId(), Role.FAN));
        for (Role role : extraRoles) {
            roles.save(new UserRole(user.getId(), role));
        }
        return user;
    }
}

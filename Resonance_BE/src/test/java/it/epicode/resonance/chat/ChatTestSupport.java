package it.epicode.resonance.chat;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.friendship.Friendship;
import it.epicode.resonance.friendship.FriendshipRepository;
import it.epicode.resonance.friendship.FriendshipStatus;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Base dei test della chat: utenti, amicizie e origini degli sblocchi (annunci ed eventi) creati direttamente nel
 * database; le candidature di F5-03 passano invece dall'endpoint vero.
 */
public abstract class ChatTestSupport extends IntegrationTest {

    @Autowired
    protected AccessTokenService accessTokens;

    @Autowired
    protected UserRepository users;

    @Autowired
    protected UserRoleRepository roles;

    @Autowired
    protected FriendshipRepository friendships;

    @Autowired
    protected ChatConversationRepository conversations;

    @Autowired
    protected ChatMessageRepository messages;

    @Autowired
    protected ChatService chatService;

    @Autowired
    protected JdbcTemplate jdbc;

    protected User user(String email, String displayName) {
        User user = new User(email, "hash-di-prova", displayName);
        user.setEmailVerified(true);
        users.save(user);
        roles.save(new UserRole(user.getId(), Role.FAN));
        return user;
    }

    protected String bearer(User user) {
        return "Bearer " + accessTokens.issue(user.getId()).token();
    }

    protected User suspended(User user, User by) {
        user.setStatus(UserStatus.SUSPENDED);
        user.setSuspendedAt(Instant.now());
        user.setSuspendedBy(by.getId());
        user.setSuspensionReason("prova");
        return users.save(user);
    }

    protected Friendship befriend(User a, User b) {
        return friendships.saveAndFlush(new Friendship(a, b, FriendshipStatus.ACCEPTED, Instant.now()));
    }

    /** Conversazione fra due utenti creata dal metodo interno, senza amicizia ne' limite. */
    protected ChatConversation conversation(User a, User b) {
        return chatService.findOrCreateConversation(a.getId(), b.getId());
    }

    protected ChatMessage message(ChatConversation conversation, User sender, String body, Instant sentAt) {
        ChatMessage message = messages.saveAndFlush(new ChatMessage(conversation, sender, body, sentAt));
        conversation.setLastMessageAt(sentAt);
        conversations.saveAndFlush(conversation);
        return message;
    }

    protected UUID openCollabPost(User musician) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into collab_posts (id, musician_id, title, description, role_needed) "
                + "values (?, ?, 'Cerco batterista', 'Descrizione', 'Batterista')", id, musician.getId());
        return id;
    }

    protected UUID officialConcert(User host, Instant eventDate) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into official_concerts (id, host_id, title, venue_name, address, latitude, longitude, "
                        + "event_date) values (?, ?, 'Concerto', 'Locale', 'Via Roma 1', 45.0, 9.0, ?)",
                id, host.getId(), java.sql.Timestamp.from(eventDate.truncatedTo(ChronoUnit.MICROS)));
        return id;
    }

    protected UUID indieEvent(User musician, Instant eventDate, String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into indie_events (id, musician_id, title, venue_name, address, latitude, longitude, "
                        + "event_date, status) values (?, ?, 'Serata', 'Locale', 'Via Roma 1', 45.0, 9.0, ?, "
                        + "cast(? as indie_event_status))",
                id, musician.getId(), java.sql.Timestamp.from(eventDate.truncatedTo(ChronoUnit.MICROS)), status);
        return id;
    }

    /** Nasconde un contenuto come farebbe un admin; la tabella e' una delle tre che hanno un sblocco. */
    protected void hide(String table, UUID id, User by) {
        jdbc.update("update " + table + " set hidden_at = now(), hidden_by = ? where id = ?", by.getId(), id);
    }
}

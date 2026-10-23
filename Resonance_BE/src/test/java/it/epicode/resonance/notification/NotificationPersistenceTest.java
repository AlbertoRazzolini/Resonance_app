package it.epicode.resonance.notification;

import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Mappatura di Notification sulla tabella della V11 (progettazione, sezione 3.2): campi, vincoli e indice univoco
 * dei like; l'avvio con ddl-auto validate controlla il resto.
 */
class NotificationPersistenceTest extends IntegrationTest {

    @Autowired
    private NotificationRepository notifications;

    @Autowired
    private UserRepository users;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void saveAndReload_keepsAllFields() {
        User recipient = user("dest@example.com");
        User actor = user("autore@example.com");
        UUID target = UUID.randomUUID();
        Instant when = Instant.parse("2026-10-23T09:00:00Z");

        Notification saved = notifications.saveAndFlush(
                new Notification(recipient, actor, NotificationType.FRIEND_REQUEST, target, when));
        Notification found = notifications.findById(saved.getId()).orElseThrow();

        assertThat(found.getRecipient().getId()).isEqualTo(recipient.getId());
        assertThat(found.getActor().getId()).isEqualTo(actor.getId());
        assertThat(found.getType()).isEqualTo(NotificationType.FRIEND_REQUEST);
        assertThat(found.getTargetId()).isEqualTo(target);
        assertThat(found.getCreatedAt()).isEqualTo(when);
        assertThat(found.getReadAt()).isNull();
    }

    @Test
    void readAt_isPersisted() {
        Notification row = notifications.saveAndFlush(new Notification(user("dest@example.com"),
                user("autore@example.com"), NotificationType.FRIEND_ACCEPTED, UUID.randomUUID(), Instant.now()));
        Instant readAt = Instant.parse("2026-10-23T10:00:00Z");

        row.setReadAt(readAt);
        notifications.saveAndFlush(row);

        assertThat(notifications.findById(row.getId()).orElseThrow().getReadAt()).isEqualTo(readAt);
    }

    @Test
    void secondLikeNotificationForTheSameActorAndPost_violatesTheUniqueIndex() {
        User recipient = user("dest@example.com");
        User actor = user("autore@example.com");
        UUID post = UUID.randomUUID();
        notifications.saveAndFlush(new Notification(recipient, actor, NotificationType.NEW_LIKE, post, Instant.now()));

        assertThatThrownBy(() -> jdbc.update(
                "insert into notifications (recipient_id, actor_id, type, target_id, created_at) "
                        + "values (?, ?, 'NEW_LIKE', ?, now())", recipient.getId(), actor.getId(), post))
                .hasMessageContaining("uq_notifications_like");
    }

    @Test
    void sameActorAndTargetWithAnotherType_isAllowed() {
        User recipient = user("dest@example.com");
        User actor = user("autore@example.com");
        UUID target = UUID.randomUUID();
        notifications.saveAndFlush(new Notification(recipient, actor, NotificationType.NEW_LIKE, target, Instant.now()));

        // L'indice univoco vale solo per i like: due candidature allo stesso annuncio non sono bloccate dal database.
        notifications.saveAndFlush(
                new Notification(recipient, actor, NotificationType.COLLAB_APPLICATION, target, Instant.now()));
        notifications.saveAndFlush(
                new Notification(recipient, actor, NotificationType.COLLAB_APPLICATION, target, Instant.now()));

        assertThat(notifications.count()).isEqualTo(3);
    }

    @Test
    void newMessageType_isNotStoredByTheDatabase() {
        User recipient = user("dest@example.com");
        User actor = user("autore@example.com");

        // NEW_MESSAGE resta solo live (decisione 97): il tipo non esiste nell'enum del database.
        assertThatThrownBy(() -> jdbc.update(
                "insert into notifications (recipient_id, actor_id, type, target_id, created_at) "
                        + "values (?, ?, 'NEW_MESSAGE', ?, now())", recipient.getId(), actor.getId(),
                UUID.randomUUID())).hasMessageContaining("notification_type");
    }

    @Test
    void selfNotification_violatesTheCheckConstraint() {
        User a = user("a@example.com");

        assertThatThrownBy(() -> jdbc.update(
                "insert into notifications (recipient_id, actor_id, type, target_id, created_at) "
                        + "values (?, ?, 'NEW_LIKE', ?, now())", a.getId(), a.getId(), UUID.randomUUID()))
                .hasMessageContaining("ck_notifications_not_self");
    }

    @Test
    void unknownUsers_areRejectedByTheDatabase() {
        User a = user("a@example.com");

        assertThatThrownBy(() -> jdbc.update(
                "insert into notifications (recipient_id, actor_id, type, target_id, created_at) "
                        + "values (?, ?, 'NEW_LIKE', ?, now())", UUID.randomUUID(), a.getId(), UUID.randomUUID()))
                .hasMessageContaining("fk_notifications_recipient");
        assertThatThrownBy(() -> jdbc.update(
                "insert into notifications (recipient_id, actor_id, type, target_id, created_at) "
                        + "values (?, ?, 'NEW_LIKE', ?, now())", a.getId(), UUID.randomUUID(), UUID.randomUUID()))
                .hasMessageContaining("fk_notifications_actor");
    }

    private User user(String email) {
        User user = new User(email, "hash-di-prova", email.substring(0, email.indexOf('@')));
        user.setEmailVerified(true);
        return users.save(user);
    }
}

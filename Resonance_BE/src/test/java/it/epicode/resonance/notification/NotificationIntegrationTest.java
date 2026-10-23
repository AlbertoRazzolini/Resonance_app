package it.epicode.resonance.notification;

import it.epicode.resonance.chat.ChatTestSupport;
import it.epicode.resonance.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.util.UUID;

import static java.time.temporal.ChronoUnit.DAYS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Endpoint delle notifiche salvate (decisione 97): elenco paginato dalla piu' recente, conteggio delle non lette,
 * segna letta e segna tutte lette. Ognuno vede e tocca solo le proprie: quelle altrui sono un 404, come per le
 * amicizie.
 */
class NotificationIntegrationTest extends ChatTestSupport {

    private static final Instant T0 = Instant.parse("2026-10-23T09:00:00Z");

    @Autowired
    private NotificationRepository notifications;

    @Autowired
    private NotificationService notificationService;

    // ---- elenco ----

    @Test
    void list_returnsOwnNotificationsNewestFirst_withTheDocumentedShape() throws Exception {
        User me = user("me@example.com", "Io");
        User actor = user("autore@example.com", "Autore");
        UUID postId = UUID.randomUUID();
        Notification old = save(me, actor, NotificationType.NEW_LIKE, postId, T0);
        Notification recent = save(me, actor, NotificationType.COLLAB_APPLICATION, UUID.randomUUID(), T0.plusSeconds(60));
        old.setReadAt(T0.plusSeconds(30));
        notifications.saveAndFlush(old);

        list(me, "").andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].id").value(recent.getId().toString()))
                .andExpect(jsonPath("$.content[0].type").value("COLLAB_APPLICATION"))
                .andExpect(jsonPath("$.content[0].read").value(false))
                .andExpect(jsonPath("$.content[0].actor.id").value(actor.getId().toString()))
                .andExpect(jsonPath("$.content[0].actor.displayName").value("Autore"))
                .andExpect(jsonPath("$.content[0].actor.email").doesNotExist())
                .andExpect(jsonPath("$.content[0].targetId").value(recent.getTargetId().toString()))
                .andExpect(jsonPath("$.content[0].createdAt").exists())
                .andExpect(jsonPath("$.content[0].preview").doesNotExist())
                .andExpect(jsonPath("$.content[1].id").value(old.getId().toString()))
                .andExpect(jsonPath("$.content[1].read").value(true));
    }

    @Test
    void list_neverShowsOthersNotifications() throws Exception {
        User me = user("me@example.com", "Io");
        User other = user("altro@example.com", "Altro");
        User actor = user("autore@example.com", "Autore");
        save(other, actor, NotificationType.NEW_LIKE, UUID.randomUUID(), T0);

        list(me, "").andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.content").isEmpty());
    }

    @Test
    void list_withSameCreatedAt_orderIsStableById() throws Exception {
        User me = user("me@example.com", "Io");
        User actor = user("autore@example.com", "Autore");
        for (int i = 0; i < 3; i++) {
            save(me, actor, NotificationType.COLLAB_APPLICATION, UUID.randomUUID(), T0);
        }

        // Stesso istante: l'ordine per id decrescente evita doppioni e buchi fra le pagine.
        String first = list(me, "?size=2&page=0").andReturn().getResponse().getContentAsString();
        String second = list(me, "?size=2&page=1").andReturn().getResponse().getContentAsString();

        var ids = notifications.findAll().stream().map(n -> n.getId().toString()).toList();
        for (String id : ids) {
            assertThat(first.contains(id) ^ second.contains(id)).as("id %s in una sola pagina", id).isTrue();
        }
    }

    @Test
    void list_isPaginated() throws Exception {
        User me = user("me@example.com", "Io");
        User actor = user("autore@example.com", "Autore");
        for (int i = 0; i < 3; i++) {
            save(me, actor, NotificationType.COLLAB_APPLICATION, UUID.randomUUID(), T0.plusSeconds(i));
        }

        list(me, "?size=2&page=1").andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
    }

    @Test
    void list_withInvalidPaging_returns400() throws Exception {
        User me = user("me@example.com", "Io");

        list(me, "?size=0").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        list(me, "?page=-1").andExpect(status().isBadRequest());
    }

    @Test
    void list_withoutLogin_returns401() throws Exception {
        mockMvc.perform(get("/api/notifications")).andExpect(status().isUnauthorized());
    }

    // ---- conteggio ----

    @Test
    void unreadCount_countsOnlyMyUnreadNotifications() throws Exception {
        User me = user("me@example.com", "Io");
        User other = user("altro@example.com", "Altro");
        User actor = user("autore@example.com", "Autore");
        save(me, actor, NotificationType.NEW_LIKE, UUID.randomUUID(), T0);
        save(me, actor, NotificationType.NEW_LIKE, UUID.randomUUID(), T0);
        Notification read = save(me, actor, NotificationType.NEW_LIKE, UUID.randomUUID(), T0);
        read.setReadAt(T0);
        notifications.saveAndFlush(read);
        save(other, actor, NotificationType.NEW_LIKE, UUID.randomUUID(), T0);

        unreadCount(me).andExpect(status().isOk()).andExpect(jsonPath("$.count").value(2));
        unreadCount(other).andExpect(jsonPath("$.count").value(1));
    }

    @Test
    void unreadCount_isZeroWithNoNotifications() throws Exception {
        unreadCount(user("me@example.com", "Io")).andExpect(status().isOk()).andExpect(jsonPath("$.count").value(0));
    }

    @Test
    void unreadCount_withoutLogin_returns401() throws Exception {
        mockMvc.perform(get("/api/notifications/unread-count")).andExpect(status().isUnauthorized());
    }

    // ---- segna letta ----

    @Test
    void markRead_setsReadAtAndReturns204() throws Exception {
        User me = user("me@example.com", "Io");
        User actor = user("autore@example.com", "Autore");
        Notification saved = save(me, actor, NotificationType.NEW_LIKE, UUID.randomUUID(), T0);
        clock.setInstant(T0.plusSeconds(120));

        markRead(me, saved.getId()).andExpect(status().isNoContent());

        assertThat(notifications.findById(saved.getId()).orElseThrow().getReadAt()).isEqualTo(T0.plusSeconds(120));
        unreadCount(me).andExpect(jsonPath("$.count").value(0));
    }

    @Test
    void markRead_whenAlreadyRead_returns204AndKeepsTheFirstReadAt() throws Exception {
        User me = user("me@example.com", "Io");
        User actor = user("autore@example.com", "Autore");
        Notification saved = save(me, actor, NotificationType.NEW_LIKE, UUID.randomUUID(), T0);
        clock.setInstant(T0.plusSeconds(60));
        markRead(me, saved.getId()).andExpect(status().isNoContent());
        clock.setInstant(T0.plusSeconds(600));

        markRead(me, saved.getId()).andExpect(status().isNoContent());

        assertThat(notifications.findById(saved.getId()).orElseThrow().getReadAt()).isEqualTo(T0.plusSeconds(60));
    }

    @Test
    void markRead_ofSomeoneElsesNotification_returns404AndChangesNothing() throws Exception {
        User me = user("me@example.com", "Io");
        User owner = user("altro@example.com", "Altro");
        User actor = user("autore@example.com", "Autore");
        Notification saved = save(owner, actor, NotificationType.NEW_LIKE, UUID.randomUUID(), T0);

        markRead(me, saved.getId()).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));

        assertThat(notifications.findById(saved.getId()).orElseThrow().getReadAt()).isNull();
    }

    @Test
    void markRead_ofUnknownNotification_returns404() throws Exception {
        markRead(user("me@example.com", "Io"), UUID.randomUUID()).andExpect(status().isNotFound());
    }

    @Test
    void markRead_withInvalidId_returns400() throws Exception {
        User me = user("me@example.com", "Io");

        mockMvc.perform(post("/api/notifications/{id}/read", "non-un-uuid").header("Authorization", bearer(me)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void markRead_withoutLogin_returns401() throws Exception {
        mockMvc.perform(post("/api/notifications/{id}/read", UUID.randomUUID())).andExpect(status().isUnauthorized());
    }

    // ---- segna tutte lette ----

    @Test
    void markAllRead_marksOnlyMyUnreadNotifications() throws Exception {
        User me = user("me@example.com", "Io");
        User other = user("altro@example.com", "Altro");
        User actor = user("autore@example.com", "Autore");
        save(me, actor, NotificationType.NEW_LIKE, UUID.randomUUID(), T0);
        Notification alreadyRead = save(me, actor, NotificationType.NEW_LIKE, UUID.randomUUID(), T0);
        alreadyRead.setReadAt(T0.plusSeconds(10));
        notifications.saveAndFlush(alreadyRead);
        Notification othersNotification = save(other, actor, NotificationType.NEW_LIKE, UUID.randomUUID(), T0);
        clock.setInstant(T0.plusSeconds(300));

        markAllRead(me).andExpect(status().isNoContent());

        unreadCount(me).andExpect(jsonPath("$.count").value(0));
        // Una gia' letta mantiene il suo orario; quella altrui non si tocca.
        assertThat(notifications.findById(alreadyRead.getId()).orElseThrow().getReadAt()).isEqualTo(T0.plusSeconds(10));
        assertThat(notifications.findById(othersNotification.getId()).orElseThrow().getReadAt()).isNull();
    }

    @Test
    void markAllRead_withNothingToRead_returns204() throws Exception {
        markAllRead(user("me@example.com", "Io")).andExpect(status().isNoContent());
    }

    @Test
    void markAllRead_withoutLogin_returns401() throws Exception {
        mockMvc.perform(post("/api/notifications/read-all")).andExpect(status().isUnauthorized());
    }

    // ---- scadenza ----

    @Test
    void deleteExpired_removesOnlyNotificationsOlderThan30Days_readOrNot() throws Exception {
        User me = user("me@example.com", "Io");
        User actor = user("autore@example.com", "Autore");
        clock.setInstant(T0);
        Notification oldUnread = save(me, actor, NotificationType.NEW_LIKE, UUID.randomUUID(), T0.minus(31, DAYS));
        Notification oldRead = save(me, actor, NotificationType.NEW_LIKE, UUID.randomUUID(), T0.minus(45, DAYS));
        oldRead.setReadAt(T0.minus(40, DAYS));
        notifications.saveAndFlush(oldRead);
        Notification recent = save(me, actor, NotificationType.NEW_LIKE, UUID.randomUUID(), T0.minus(29, DAYS));

        notificationService.deleteExpired();

        // La conservazione conta dalla creazione, non dalla lettura (decisione 97).
        assertThat(notifications.findAll()).extracting(Notification::getId).containsExactly(recent.getId());
        assertThat(notifications.existsById(oldUnread.getId())).isFalse();
    }

    // ---- supporto ----

    private Notification save(User recipient, User actor, NotificationType type, UUID targetId, Instant createdAt) {
        return notifications.saveAndFlush(new Notification(recipient, actor, type, targetId, createdAt));
    }

    private ResultActions list(User caller, String query) throws Exception {
        return mockMvc.perform(get("/api/notifications" + query).header("Authorization", bearer(caller)));
    }

    private ResultActions unreadCount(User caller) throws Exception {
        return mockMvc.perform(get("/api/notifications/unread-count").header("Authorization", bearer(caller)));
    }

    private ResultActions markRead(User caller, UUID id) throws Exception {
        return mockMvc.perform(post("/api/notifications/{id}/read", id).header("Authorization", bearer(caller)));
    }

    private ResultActions markAllRead(User caller) throws Exception {
        return mockMvc.perform(post("/api/notifications/read-all").header("Authorization", bearer(caller)));
    }
}

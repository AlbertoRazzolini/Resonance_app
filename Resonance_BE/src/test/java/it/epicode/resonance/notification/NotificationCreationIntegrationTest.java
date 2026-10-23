package it.epicode.resonance.notification;

import it.epicode.resonance.chat.ChatTestSupport;
import it.epicode.resonance.feed.FeedPost;
import it.epicode.resonance.feed.FeedPostRepository;
import it.epicode.resonance.friendship.Friendship;
import it.epicode.resonance.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Creazione, chiusura e cancellazione delle notifiche salvate (decisione 97): richiesta di amicizia, accettazione,
 * rifiuto silenzioso e annullamento, like senza doppioni, candidatura a un annuncio. Tutto passa dagli endpoint veri.
 */
class NotificationCreationIntegrationTest extends ChatTestSupport {

    private static final String APPLICATION = "{\"message\": \"Suono la batteria da dieci anni\"}";

    @Autowired
    private NotificationRepository notifications;

    @Autowired
    private FeedPostRepository feedPosts;

    // ---- amicizie ----

    @Test
    void friendRequest_savesAnUnreadNotificationForTheAddressee() throws Exception {
        // Microsecondi esatti: il database arrotonda i nanosecondi dell'orologio di sistema.
        clock.setInstant(Instant.parse("2026-10-23T09:00:00Z"));
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");

        request(a, b).andExpect(status().isCreated());

        Friendship row = friendships.findAll().get(0);
        Notification saved = only();
        assertThat(saved.getRecipient().getId()).isEqualTo(b.getId());
        assertThat(saved.getActor().getId()).isEqualTo(a.getId());
        assertThat(saved.getType()).isEqualTo(NotificationType.FRIEND_REQUEST);
        // targetId e' l'amicizia (decisione 97): accetta, rifiuta e annulla la ritrovano da li'.
        assertThat(saved.getTargetId()).isEqualTo(row.getId());
        assertThat(saved.getReadAt()).isNull();
        assertThat(saved.getCreatedAt()).isEqualTo(clock.instant());
    }

    @Test
    void repeatedRequest_rejectedWith409_doesNotCreateAnotherNotification() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        request(a, b).andExpect(status().isCreated());

        request(a, b).andExpect(status().isConflict());

        assertThat(notifications.count()).isEqualTo(1);
    }

    @Test
    void accept_marksTheRequestReadAndNotifiesTheRequester() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        request(a, b).andExpect(status().isCreated());
        Friendship row = friendships.findAll().get(0);
        clock.setInstant(Instant.parse("2026-10-23T09:00:00Z").plus(Duration.ofSeconds(60)));

        act(b, "accept", row).andExpect(status().isOk());

        List<Notification> all = notifications.findAll();
        assertThat(all).hasSize(2);
        Notification received = byType(all, NotificationType.FRIEND_REQUEST);
        assertThat(received.getRecipient().getId()).isEqualTo(b.getId());
        // La richiesta gestita resta nell'elenco, segnata letta all'istante dell'accettazione.
        assertThat(received.getReadAt()).isEqualTo(clock.instant());
        Notification accepted = byType(all, NotificationType.FRIEND_ACCEPTED);
        assertThat(accepted.getRecipient().getId()).isEqualTo(a.getId());
        assertThat(accepted.getActor().getId()).isEqualTo(b.getId());
        assertThat(accepted.getTargetId()).isEqualTo(row.getId());
        assertThat(accepted.getReadAt()).isNull();
    }

    @Test
    void failedAccept_doesNotChangeNotifications() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        request(a, b).andExpect(status().isCreated());
        Friendship row = friendships.findAll().get(0);

        // Solo il destinatario accetta: il richiedente riceve 403 e niente cambia.
        act(a, "accept", row).andExpect(status().isForbidden());

        Notification saved = only();
        assertThat(saved.getType()).isEqualTo(NotificationType.FRIEND_REQUEST);
        assertThat(saved.getReadAt()).isNull();
    }

    @Test
    void decline_marksTheRequestReadAndNotifiesNobody() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        request(a, b).andExpect(status().isCreated());
        Friendship row = friendships.findAll().get(0);

        act(b, "decline", row).andExpect(status().isNoContent());

        // Il rifiuto e' silenzioso (decisione 59): nessuna notifica a chi ha chiesto.
        Notification saved = only();
        assertThat(saved.getRecipient().getId()).isEqualTo(b.getId());
        assertThat(saved.getReadAt()).isNotNull();
    }

    @Test
    void cancel_deletesTheAddresseeNotification() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        request(a, b).andExpect(status().isCreated());
        Friendship row = friendships.findAll().get(0);

        act(a, "cancel", row).andExpect(status().isNoContent());

        assertThat(notifications.count()).isZero();
    }

    @Test
    void requestAfterCancel_createsANewNotification() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        request(a, b).andExpect(status().isCreated());
        act(a, "cancel", friendships.findAll().get(0)).andExpect(status().isNoContent());

        request(a, b).andExpect(status().isCreated());

        Notification saved = only();
        assertThat(saved.getType()).isEqualTo(NotificationType.FRIEND_REQUEST);
        assertThat(saved.getReadAt()).isNull();
    }

    @Test
    void requestAfterBeingDeclinedByTheOtherSide_isSilent() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        request(a, b).andExpect(status().isCreated());
        Friendship row = friendships.findAll().get(0);
        act(b, "decline", row).andExpect(status().isNoContent());
        // Rifiuto silenzioso: A annulla la richiesta rifiutata e poi chiede di nuovo, senza avvisare B (sezione 6.14).
        act(a, "cancel", row).andExpect(status().isNoContent());

        request(a, b).andExpect(status().isCreated());

        // Resta solo la notifica del primo invio, gia' letta: la seconda richiesta non ne crea una nuova.
        Notification saved = only();
        assertThat(saved.getReadAt()).isNotNull();
    }

    @Test
    void requestReopenedByTheOneWhoDeclined_notifiesTheOtherSide() throws Exception {
        User a = user("a@example.com", "Alice");
        User b = user("b@example.com", "Bruno");
        request(a, b).andExpect(status().isCreated());
        act(b, "decline", friendships.findAll().get(0)).andExpect(status().isNoContent());

        // B ha chiuso e ora chiede lui: la riga si riapre a parti invertite e A riceve la notifica.
        request(b, a).andExpect(status().isCreated());

        List<Notification> forA = notifications.findAll().stream()
                .filter(n -> n.getRecipient().getId().equals(a.getId())).toList();
        assertThat(forA).hasSize(1);
        assertThat(forA.get(0).getType()).isEqualTo(NotificationType.FRIEND_REQUEST);
        assertThat(forA.get(0).getActor().getId()).isEqualTo(b.getId());
    }

    // ---- like ----

    @Test
    void like_savesANotificationForTheAuthor() throws Exception {
        User author = user("autore@example.com", "Autore");
        User fan = user("fan@example.com", "Fan");
        FeedPost feedPost = feedPosts.saveAndFlush(new FeedPost(author, "Ciao"));

        like(fan, feedPost.getId()).andExpect(status().isOk());

        Notification saved = only();
        assertThat(saved.getRecipient().getId()).isEqualTo(author.getId());
        assertThat(saved.getActor().getId()).isEqualTo(fan.getId());
        assertThat(saved.getType()).isEqualTo(NotificationType.NEW_LIKE);
        assertThat(saved.getTargetId()).isEqualTo(feedPost.getId());
    }

    @Test
    void ownLike_doesNotSaveANotification() throws Exception {
        User author = user("autore@example.com", "Autore");
        FeedPost feedPost = feedPosts.saveAndFlush(new FeedPost(author, "Ciao"));

        like(author, feedPost.getId()).andExpect(status().isOk());

        assertThat(notifications.count()).isZero();
    }

    @Test
    void likeUnlikeLike_savesASingleNotification() throws Exception {
        User author = user("autore@example.com", "Autore");
        User fan = user("fan@example.com", "Fan");
        FeedPost feedPost = feedPosts.saveAndFlush(new FeedPost(author, "Ciao"));

        like(fan, feedPost.getId()).andExpect(status().isOk());
        like(fan, feedPost.getId()).andExpect(status().isOk());
        unlike(fan, feedPost.getId()).andExpect(status().isOk());
        like(fan, feedPost.getId()).andExpect(status().isOk());

        assertThat(notifications.count()).isEqualTo(1);
    }

    @Test
    void likesFromDifferentUsers_saveOneNotificationEach() throws Exception {
        User author = user("autore@example.com", "Autore");
        FeedPost feedPost = feedPosts.saveAndFlush(new FeedPost(author, "Ciao"));

        like(user("uno@example.com", "Uno"), feedPost.getId()).andExpect(status().isOk());
        like(user("due@example.com", "Due"), feedPost.getId()).andExpect(status().isOk());

        assertThat(notifications.count()).isEqualTo(2);
    }

    // ---- candidature ----

    @Test
    void apply_savesACollabApplicationNotificationForTheAuthor() throws Exception {
        User author = user("autore@example.com", "Autore");
        User applicant = user("candidato@example.com", "Candidato");
        UUID postId = openCollabPost(author);

        mockMvc.perform(post("/api/collab-posts/{id}/applications", postId)
                        .header("Authorization", bearer(applicant))
                        .contentType(MediaType.APPLICATION_JSON).content(APPLICATION))
                .andExpect(status().isCreated());

        Notification saved = only();
        assertThat(saved.getRecipient().getId()).isEqualTo(author.getId());
        assertThat(saved.getActor().getId()).isEqualTo(applicant.getId());
        assertThat(saved.getType()).isEqualTo(NotificationType.COLLAB_APPLICATION);
        assertThat(saved.getTargetId()).isEqualTo(postId);
    }

    // ---- supporto ----

    private ResultActions request(User caller, User target) throws Exception {
        return mockMvc.perform(post("/api/friendships").header("Authorization", bearer(caller))
                .contentType(MediaType.APPLICATION_JSON).content("{\"userId\": \"" + target.getId() + "\"}"));
    }

    private ResultActions act(User caller, String verb, Friendship row) throws Exception {
        return mockMvc.perform(post("/api/friendships/{id}/" + verb, row.getId())
                .header("Authorization", bearer(caller)));
    }

    private ResultActions like(User user, UUID postId) throws Exception {
        return mockMvc.perform(put("/api/feed-posts/{id}/like", postId).header("Authorization", bearer(user)));
    }

    private ResultActions unlike(User user, UUID postId) throws Exception {
        return mockMvc.perform(delete("/api/feed-posts/{id}/like", postId).header("Authorization", bearer(user)));
    }

    private Notification only() {
        assertThat(notifications.count()).isEqualTo(1);
        return notifications.findAll().get(0);
    }

    private Notification byType(List<Notification> all, NotificationType type) {
        return all.stream().filter(n -> n.getType() == type).findFirst().orElseThrow();
    }
}

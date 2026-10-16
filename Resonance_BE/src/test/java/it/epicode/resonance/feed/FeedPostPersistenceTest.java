package it.epicode.resonance.feed;

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
 * Mappatura di FeedPost sulla tabella della V7 (progettazione, sezione 3.2): campi, valori di default e vincoli
 * del database (l'avvio con ddl-auto validate controlla il resto).
 */
class FeedPostPersistenceTest extends IntegrationTest {

    @Autowired
    private FeedPostRepository posts;

    @Autowired
    private UserRepository users;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void saveAndReload_keepsAllFields() {
        User author = author();
        FeedPost post = new FeedPost(author, "Che serata");
        post.setImageUrl("https://example.com/foto.jpg");
        post.setLatitude(43.77);
        post.setLongitude(11.25);
        posts.saveAndFlush(post);

        FeedPost found = posts.findById(post.getId()).orElseThrow();

        assertThat(found.getAuthor().getId()).isEqualTo(author.getId());
        assertThat(found.getBody()).isEqualTo("Che serata");
        assertThat(found.getImageUrl()).isEqualTo("https://example.com/foto.jpg");
        assertThat(found.getLatitude()).isEqualTo(43.77);
        assertThat(found.getLongitude()).isEqualTo(11.25);
        // createdAt arriva dal DEFAULT now() del database.
        assertThat(found.getCreatedAt()).isNotNull();
    }

    @Test
    void newPost_hasNoLikesNoCoordinatesAndIsVisible() {
        FeedPost post = posts.saveAndFlush(new FeedPost(author(), "Solo testo"));

        FeedPost found = posts.findById(post.getId()).orElseThrow();

        assertThat(found.getLikesCount()).isZero();
        assertThat(found.getImageUrl()).isNull();
        assertThat(found.getLatitude()).isNull();
        assertThat(found.getLongitude()).isNull();
        assertThat(found.getModeration().isHidden()).isFalse();
    }

    @Test
    void hide_isPersisted() {
        User author = author();
        FeedPost post = posts.saveAndFlush(new FeedPost(author, "Da nascondere"));
        Instant when = Instant.parse("2026-10-16T10:00:00Z");

        post.getModeration().hide(author.getId(), "errore", when);
        posts.saveAndFlush(post);
        FeedPost found = posts.findById(post.getId()).orElseThrow();

        assertThat(found.getModeration().isHidden()).isTrue();
        assertThat(found.getModeration().getHiddenAt()).isEqualTo(when);
        assertThat(found.getModeration().getHiddenBy()).isEqualTo(author.getId());
        assertThat(found.getModeration().getHiddenReason()).isEqualTo("errore");
    }

    @Test
    void hiddenAtWithoutHiddenBy_violatesTheCheckConstraint() {
        FeedPost post = posts.saveAndFlush(new FeedPost(author(), "Un post"));

        assertThatThrownBy(() -> jdbc.update("update feed_posts set hidden_at = now() where id = ?", post.getId()))
                .hasMessageContaining("ck_feed_posts_hidden");
    }

    @Test
    void singleCoordinateOrOutOfRange_violatesTheCheckConstraint() {
        FeedPost post = posts.saveAndFlush(new FeedPost(author(), "Un post"));

        assertThatThrownBy(() -> jdbc.update("update feed_posts set latitude = 43.7 where id = ?", post.getId()))
                .hasMessageContaining("ck_feed_posts_coordinates");
        assertThatThrownBy(() -> jdbc.update(
                "update feed_posts set latitude = 91, longitude = 11 where id = ?", post.getId()))
                .hasMessageContaining("ck_feed_posts_coordinates");
    }

    @Test
    void negativeLikesCount_violatesTheCheckConstraint() {
        FeedPost post = posts.saveAndFlush(new FeedPost(author(), "Un post"));

        assertThatThrownBy(() -> jdbc.update("update feed_posts set likes_count = -1 where id = ?", post.getId()))
                .hasMessageContaining("ck_feed_posts_likes");
    }

    @Test
    void unknownAuthor_isRejectedByTheDatabase() {
        assertThatThrownBy(() -> jdbc.update("insert into feed_posts (author_id, body) values (?, 'ciao')",
                UUID.randomUUID()))
                .hasMessageContaining("fk_feed_posts_author");
    }

    private User author() {
        User author = new User("autore@example.com", "hash-di-prova", "Autore");
        author.setEmailVerified(true);
        return users.save(author);
    }
}

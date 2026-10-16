package it.epicode.resonance.collab;

import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Mappatura di CollabPost sulla tabella della V6 (progettazione, sezione 3.2): campi, valori di default e vincoli
 * del database (l'avvio con ddl-auto validate controlla il resto).
 */
class CollabPostPersistenceTest extends IntegrationTest {

    @Autowired
    private CollabPostRepository posts;

    @Autowired
    private UserRepository users;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void saveAndReload_keepsAllFields() {
        User musician = musician();
        CollabPost post = new CollabPost(musician, "Cerco batterista", "Band indie in cerca di batteria", "Batterista");
        post.setGenreTags(List.of("rock", "jazz"));
        post.setLocation("Firenze");
        posts.saveAndFlush(post);

        CollabPost found = posts.findById(post.getId()).orElseThrow();

        assertThat(found.getMusician().getId()).isEqualTo(musician.getId());
        assertThat(found.getTitle()).isEqualTo("Cerco batterista");
        assertThat(found.getDescription()).isEqualTo("Band indie in cerca di batteria");
        assertThat(found.getRoleNeeded()).isEqualTo("Batterista");
        assertThat(found.getGenreTags()).containsExactly("rock", "jazz");
        assertThat(found.getLocation()).isEqualTo("Firenze");
        // createdAt arriva dal DEFAULT now() del database.
        assertThat(found.getCreatedAt()).isNotNull();
    }

    @Test
    void newPost_isOpenAndVisibleByDefault() {
        CollabPost post = posts.saveAndFlush(new CollabPost(musician(), "Cerco bassista", "Descrizione", "Bassista"));

        CollabPost found = posts.findById(post.getId()).orElseThrow();

        assertThat(found.isOpen()).isTrue();
        assertThat(found.getGenreTags()).isEmpty();
        assertThat(found.getLocation()).isNull();
        assertThat(found.getModeration().isHidden()).isFalse();
    }

    @Test
    void closeAndHide_arePersisted() {
        User musician = musician();
        CollabPost post = posts.saveAndFlush(new CollabPost(musician, "Cerco voce", "Descrizione", "Cantante"));
        Instant when = Instant.parse("2026-10-16T10:00:00Z");

        post.setOpen(false);
        post.getModeration().hide(musician.getId(), "trovato", when);
        posts.saveAndFlush(post);
        CollabPost found = posts.findById(post.getId()).orElseThrow();

        assertThat(found.isOpen()).isFalse();
        assertThat(found.getModeration().isHidden()).isTrue();
        assertThat(found.getModeration().getHiddenAt()).isEqualTo(when);
        assertThat(found.getModeration().getHiddenBy()).isEqualTo(musician.getId());
        assertThat(found.getModeration().getHiddenReason()).isEqualTo("trovato");
    }

    @Test
    void hiddenAtWithoutHiddenBy_violatesTheCheckConstraint() {
        CollabPost post = posts.saveAndFlush(new CollabPost(musician(), "Cerco voce", "Descrizione", "Cantante"));

        assertThatThrownBy(() -> jdbc.update("update collab_posts set hidden_at = now() where id = ?", post.getId()))
                .hasMessageContaining("ck_collab_posts_hidden");
    }

    @Test
    void unknownMusician_isRejectedByTheDatabase() {
        assertThatThrownBy(() -> jdbc.update("""
                insert into collab_posts (musician_id, title, description, role_needed)
                values (?, 't', 'd', 'r')""", UUID.randomUUID()))
                .hasMessageContaining("fk_collab_posts_musician");
    }

    private User musician() {
        User musician = new User("musicista@example.com", "hash-di-prova", "Musicista");
        musician.setEmailVerified(true);
        return users.save(musician);
    }
}

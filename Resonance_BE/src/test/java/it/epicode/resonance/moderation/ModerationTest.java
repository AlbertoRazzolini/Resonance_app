package it.epicode.resonance.moderation;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Stato di moderazione di un contenuto (progettazione, sezioni 3.5 e 5.7): nascondere, ripristinare e
 * distinguere la cancellazione del proprietario da quella di un admin.
 */
class ModerationTest {

    private final UUID author = UUID.randomUUID();
    private final UUID admin = UUID.randomUUID();
    private final Instant now = Instant.parse("2026-10-16T10:00:00Z");

    @Test
    void newModeration_isNotHidden() {
        Moderation moderation = new Moderation();

        assertThat(moderation.isHidden()).isFalse();
        assertThat(moderation.getHiddenAt()).isNull();
        assertThat(moderation.getHiddenBy()).isNull();
        assertThat(moderation.getHiddenReason()).isNull();
    }

    @Test
    void hide_setsAllThreeFields() {
        Moderation moderation = new Moderation();

        moderation.hide(admin, "contenuto offensivo", now);

        assertThat(moderation.isHidden()).isTrue();
        assertThat(moderation.getHiddenAt()).isEqualTo(now);
        assertThat(moderation.getHiddenBy()).isEqualTo(admin);
        assertThat(moderation.getHiddenReason()).isEqualTo("contenuto offensivo");
    }

    @Test
    void hide_withoutReason_keepsReasonNull() {
        Moderation moderation = new Moderation();

        // Il proprietario può cancellare senza motivo (sezione 5.7).
        moderation.hide(author, null, now);

        assertThat(moderation.isHidden()).isTrue();
        assertThat(moderation.getHiddenReason()).isNull();
    }

    @Test
    void restore_clearsAllThreeFields() {
        Moderation moderation = new Moderation();
        moderation.hide(admin, "spam", now);

        moderation.restore();

        assertThat(moderation.isHidden()).isFalse();
        assertThat(moderation.getHiddenBy()).isNull();
        assertThat(moderation.getHiddenReason()).isNull();
    }

    @Test
    void hiddenByAuthor_isTrueOnlyWhenTheAuthorHidIt() {
        Moderation byOwner = new Moderation();
        byOwner.hide(author, null, now);
        Moderation byAdmin = new Moderation();
        byAdmin.hide(admin, "spam", now);

        assertThat(byOwner.hiddenByAuthor(author)).isTrue();
        assertThat(byAdmin.hiddenByAuthor(author)).isFalse();
        // Un contenuto non nascosto non è stato cancellato da nessuno.
        assertThat(new Moderation().hiddenByAuthor(author)).isFalse();
    }
}

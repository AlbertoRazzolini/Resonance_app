package it.epicode.resonance.moderation.dto;

import it.epicode.resonance.moderation.Moderation;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.dto.AuthorSummary;

import java.time.Instant;
import java.util.UUID;

/**
 * Voce dell'elenco dei contenuti nascosti (progettazione, sezione 5.7). {@code title} e' il titolo, o un estratto
 * del testo per i post del feed; {@code deletedByOwner} distingue la cancellazione del proprietario (non
 * ripristinabile) dalla moderazione di un admin.
 */
public record HiddenContentResponse(UUID id, AuthorSummary author, String title, Instant hiddenAt, UUID hiddenBy,
                                    String hiddenReason, boolean deletedByOwner) {

    private static final int EXCERPT_LENGTH = 100;

    /**
     * Compone la voce da un contenuto nascosto di qualunque tipo; un titolo piu' lungo di 100 caratteri viene
     * accorciato con i puntini.
     */
    public static HiddenContentResponse of(UUID id, User author, String title, Moderation moderation) {
        String excerpt = title.length() <= EXCERPT_LENGTH ? title : title.substring(0, EXCERPT_LENGTH) + "...";
        return new HiddenContentResponse(id, AuthorSummary.from(author), excerpt, moderation.getHiddenAt(),
                moderation.getHiddenBy(), moderation.getHiddenReason(), moderation.hiddenByAuthor(author.getId()));
    }
}

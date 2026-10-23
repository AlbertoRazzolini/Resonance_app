package it.epicode.resonance.collab.dto;

import it.epicode.resonance.collab.CollabPost;
import it.epicode.resonance.user.dto.AuthorSummary;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Annuncio di collaborazione nelle risposte (progettazione, sezione 6.7); l'autore e' ridotto ai dati pubblici.
 * {@code applicationConversationId} e' la conversazione della candidatura del chiamante e vale solo nel dettaglio
 * (decisione 100): null per anonimi, autore e chi non si e' candidato, e in ogni altra risposta, dove non e' calcolato.
 */
public record CollabPostResponse(
        UUID id,
        AuthorSummary musician,
        String title,
        String description,
        String roleNeeded,
        List<String> genreTags,
        String location,
        boolean isOpen,
        Instant createdAt,
        UUID applicationConversationId
) {

    /**
     * Converte l'annuncio senza il dato della candidatura; l'autore deve essere gia' caricato.
     */
    public static CollabPostResponse from(CollabPost post) {
        return from(post, null);
    }

    /**
     * Converte l'annuncio con la conversazione della candidatura del chiamante (null se non c'e'); l'autore deve
     * essere gia' caricato.
     */
    public static CollabPostResponse from(CollabPost post, UUID applicationConversationId) {
        return new CollabPostResponse(
                post.getId(),
                AuthorSummary.from(post.getMusician()),
                post.getTitle(),
                post.getDescription(),
                post.getRoleNeeded(),
                List.copyOf(post.getGenreTags()),
                post.getLocation(),
                post.isOpen(),
                post.getCreatedAt(),
                applicationConversationId);
    }
}

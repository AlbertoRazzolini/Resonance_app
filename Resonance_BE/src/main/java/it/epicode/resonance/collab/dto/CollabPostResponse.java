package it.epicode.resonance.collab.dto;

import it.epicode.resonance.collab.CollabPost;
import it.epicode.resonance.user.dto.AuthorSummary;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Annuncio di collaborazione nelle risposte (progettazione, sezione 6.7); l'autore e' ridotto ai dati pubblici.
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
        Instant createdAt
) {

    /**
     * Converte l'annuncio; l'autore deve essere gia' caricato.
     */
    public static CollabPostResponse from(CollabPost post) {
        return new CollabPostResponse(
                post.getId(),
                AuthorSummary.from(post.getMusician()),
                post.getTitle(),
                post.getDescription(),
                post.getRoleNeeded(),
                List.copyOf(post.getGenreTags()),
                post.getLocation(),
                post.isOpen(),
                post.getCreatedAt());
    }
}

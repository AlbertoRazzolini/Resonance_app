package it.epicode.resonance.feed.dto;

import it.epicode.resonance.feed.FeedPost;
import it.epicode.resonance.user.dto.AuthorSummary;

import java.time.Instant;
import java.util.UUID;

/**
 * Post del feed nelle risposte (progettazione, sezione 6.8). {@code likedByMe} e' sempre falso per chi non e'
 * autenticato; {@code distanceKm} e' valorizzato solo nella lista con il filtro per raggio.
 */
public record FeedPostResponse(
        UUID id,
        AuthorSummary author,
        String body,
        String imageUrl,
        Double latitude,
        Double longitude,
        int likesCount,
        boolean likedByMe,
        Instant createdAt,
        Double distanceKm
) {

    /**
     * Converte il post; l'autore deve essere gia' caricato.
     */
    public static FeedPostResponse from(FeedPost post, boolean likedByMe, Double distanceKm) {
        return new FeedPostResponse(
                post.getId(),
                AuthorSummary.from(post.getAuthor()),
                post.getBody(),
                post.getImageUrl(),
                post.getLatitude(),
                post.getLongitude(),
                post.getLikesCount(),
                likedByMe,
                post.getCreatedAt(),
                distanceKm);
    }
}

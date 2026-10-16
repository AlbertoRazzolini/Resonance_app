package it.epicode.resonance.feed.dto;

/**
 * Esito di like e unlike (progettazione, sezione 6.8): contatore aggiornato e stato del like del chiamante.
 */
public record LikeStatusResponse(int likesCount, boolean likedByMe) {
}

package it.epicode.resonance.feed.dto;

import it.epicode.resonance.common.HttpUrl;
import it.epicode.resonance.user.dto.CoordinatesTogether;
import it.epicode.resonance.user.dto.HasCoordinates;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import static it.epicode.resonance.event.EventInputNormalizer.emptyToNull;
import static it.epicode.resonance.event.EventInputNormalizer.strip;

/**
 * Creazione di un post del feed (progettazione, sezione 6.8). Immagine e coordinate sono facoltative; le
 * coordinate si inviano insieme o non si inviano.
 */
@CoordinatesTogether
public record CreateFeedPostRequest(
        @NotBlank @Size(max = 2000) String body,
        @HttpUrl String imageUrl,
        @DecimalMin("-90") @DecimalMax("90") Double latitude,
        @DecimalMin("-180") @DecimalMax("180") Double longitude
) implements HasCoordinates {

    // Trim prima della validazione: un testo di soli spazi risulta vuoto e viene rifiutato.
    public CreateFeedPostRequest {
        body = strip(body);
        imageUrl = emptyToNull(strip(imageUrl));
    }
}

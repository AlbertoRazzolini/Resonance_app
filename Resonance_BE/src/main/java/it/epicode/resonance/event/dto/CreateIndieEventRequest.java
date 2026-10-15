package it.epicode.resonance.event.dto;

import it.epicode.resonance.common.HttpUrl;
import it.epicode.resonance.event.IndieEventStatus;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

import static it.epicode.resonance.event.EventInputNormalizer.emptyToNull;
import static it.epicode.resonance.event.EventInputNormalizer.normalizeTags;
import static it.epicode.resonance.event.EventInputNormalizer.strip;

/**
 * Creazione di un indie event (progettazione, sezione 6.6). Le coordinate non si inviano: le ricava la
 * geocodifica dell'indirizzo. {@code status} e {@code isFree} sono facoltativi (default PUBLISHED e false).
 */
public record CreateIndieEventRequest(
        @NotBlank @Size(min = 3, max = 150) String title,
        @Size(max = 5000) String description,
        @NotBlank @Size(max = 150) String venueName,
        @NotBlank @Size(max = 255) String address,
        @NotNull @Future Instant eventDate,
        @Size(max = 10) List<@NotNull @Size(min = 1, max = 30) String> genreTags,
        @HttpUrl String coverImageUrl,
        Boolean isFree,
        IndieEventStatus status
) {

    // Stessa normalizzazione dei concerti (EventInputNormalizer), prima della validazione.
    public CreateIndieEventRequest {
        title = strip(title);
        description = emptyToNull(strip(description));
        venueName = strip(venueName);
        address = strip(address);
        genreTags = normalizeTags(genreTags);
        coverImageUrl = emptyToNull(strip(coverImageUrl));
    }
}

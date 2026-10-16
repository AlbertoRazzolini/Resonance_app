package it.epicode.resonance.collab.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

import static it.epicode.resonance.event.EventInputNormalizer.emptyToNull;
import static it.epicode.resonance.event.EventInputNormalizer.normalizeTags;
import static it.epicode.resonance.event.EventInputNormalizer.strip;

/**
 * Creazione di un annuncio di collaborazione (progettazione, sezione 6.7). Generi e luogo sono facoltativi.
 */
public record CreateCollabPostRequest(
        @NotBlank @Size(min = 3, max = 150) String title,
        @NotBlank @Size(max = 5000) String description,
        @NotBlank @Size(max = 100) String roleNeeded,
        @Size(max = 10) List<@NotNull @Size(min = 1, max = 30) String> genreTags,
        @Size(max = 150) String location
) {

    // Stessa normalizzazione degli eventi (EventInputNormalizer), prima della validazione.
    public CreateCollabPostRequest {
        title = strip(title);
        description = strip(description);
        roleNeeded = strip(roleNeeded);
        genreTags = normalizeTags(genreTags);
        location = emptyToNull(strip(location));
    }
}

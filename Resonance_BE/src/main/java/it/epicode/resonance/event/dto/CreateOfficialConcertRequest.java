package it.epicode.resonance.event.dto;

import it.epicode.resonance.common.HttpUrl;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

/**
 * Creazione di un concerto ufficiale (progettazione, sezione 6.6). Le coordinate non si inviano: le ricava la
 * geocodifica dell'indirizzo. {@code eventDate} e' un Instant: una data senza fuso orario viene rifiutata.
 */
public record CreateOfficialConcertRequest(
        @NotBlank @Size(min = 3, max = 150) String title,
        @Size(max = 5000) String description,
        @NotBlank @Size(max = 150) String venueName,
        @NotBlank @Size(max = 255) String address,
        @NotNull @Future Instant eventDate,
        @Size(max = 10) List<@Size(min = 1, max = 30) String> genreTags,
        @HttpUrl String coverImageUrl,
        @HttpUrl String externalTicketUrl
) {

    // Normalizza prima della validazione: testi con trim, facoltativi vuoti = assenti, generi in minuscolo e
    // senza duplicati (un genere fatto di soli spazi resta "" e viene rifiutato da @Size(min = 1)).
    public CreateOfficialConcertRequest {
        title = strip(title);
        description = emptyToNull(strip(description));
        venueName = strip(venueName);
        address = strip(address);
        genreTags = normalizeTags(genreTags);
        coverImageUrl = emptyToNull(strip(coverImageUrl));
        externalTicketUrl = emptyToNull(strip(externalTicketUrl));
    }

    private static List<String> normalizeTags(List<String> tags) {
        if (tags == null) {
            return List.of();
        }
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String tag : tags) {
            // Un elemento null resta tale: lo segnala la validazione, non un NullPointerException.
            normalized.add(tag == null ? null : tag.strip().toLowerCase(Locale.ROOT));
        }
        return List.copyOf(normalized);
    }

    private static String strip(String value) {
        return value == null ? null : value.strip();
    }

    private static String emptyToNull(String value) {
        return value == null || value.isEmpty() ? null : value;
    }
}

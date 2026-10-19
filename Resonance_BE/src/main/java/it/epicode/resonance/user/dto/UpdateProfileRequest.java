package it.epicode.resonance.user.dto;

import it.epicode.resonance.common.HttpUrl;
import it.epicode.resonance.common.NoEmoji;
import it.epicode.resonance.common.NoInvisibleChars;
import it.epicode.resonance.common.NotBlankIfPresent;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

/**
 * Modifica parziale del profilo (progettazione, sezioni 6.1 e 6.5). Campo assente o null = invariato; per i
 * testi facoltativi la stringa vuota (anche dopo il trim) svuota il campo. Il displayName e' obbligatorio e
 * non si svuota, ha da 2 a 30 caratteri e niente emoji ne' caratteri invisibili (decisione 84). Le coordinate non si
 * svuotano da qui: serve DELETE /api/users/me/location.
 */
@CoordinatesTogether
public record UpdateProfileRequest(
        @NotBlankIfPresent @Size(min = 2, max = 30) @NoEmoji @NoInvisibleChars String displayName,
        @HttpUrl String avatarUrl,
        @Size(max = 500) String bio,
        @Size(max = 100) String city,
        @DecimalMin("-90") @DecimalMax("90") Double latitude,
        @DecimalMin("-180") @DecimalMax("180") Double longitude
) implements HasCoordinates {

    // Trim qui, prima della validazione: "  " diventa "" e viene trattato come vuoto, non come testo.
    public UpdateProfileRequest {
        displayName = strip(displayName);
        avatarUrl = strip(avatarUrl);
        bio = strip(bio);
        city = strip(city);
    }

    private static String strip(String value) {
        return value == null ? null : value.strip();
    }
}

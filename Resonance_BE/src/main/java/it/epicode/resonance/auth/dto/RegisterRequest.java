package it.epicode.resonance.auth.dto;

import it.epicode.resonance.auth.PasswordMax72Bytes;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Locale;

/**
 * Dati della registrazione (progettazione, sezioni 4.4 e 6.4). L'email si normalizza come nel login
 * ({@link LoginRequest}); la password non si tocca, perche' gli spazi ne fanno parte.
 */
public record RegisterRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 8, max = 72) @PasswordMax72Bytes String password,
        @NotBlank @Size(min = 2, max = 50) String displayName
) {

    // Normalizzazione qui, prima della validazione: @Email vede gia' il valore pulito.
    public RegisterRequest {
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
        displayName = displayName == null ? null : displayName.strip();
    }

    // La password non deve finire nei log nemmeno per errore (progettazione, sezione 8.9).
    @Override
    public String toString() {
        return "RegisterRequest[email=" + email + ", displayName=" + displayName + "]";
    }
}

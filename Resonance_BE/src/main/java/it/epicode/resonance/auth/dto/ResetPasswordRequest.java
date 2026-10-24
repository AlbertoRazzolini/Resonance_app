package it.epicode.resonance.auth.dto;

import it.epicode.resonance.auth.PasswordHasLetterAndDigit;
import it.epicode.resonance.auth.PasswordMax72Bytes;
import it.epicode.resonance.common.NoEmoji;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.Locale;

/**
 * Reset della password (progettazione, sezioni 4.10 e 6.4): codice a 6 cifre ricevuto per email e nuova
 * password, con le stesse regole della registrazione (8-72 caratteri, massimo 72 byte UTF-8, senza emoji:
 * decisione 84). L'email si normalizza come nel login ({@link LoginRequest}); la password non si tocca, perche'
 * gli spazi ne fanno parte.
 */
public record ResetPasswordRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Pattern(regexp = "\\d{6}", message = "deve essere di 6 cifre") String code,
        @NotBlank @Size(min = 8, max = 72) @PasswordMax72Bytes @NoEmoji @PasswordHasLetterAndDigit String newPassword
) {

    public ResetPasswordRequest {
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }

    // Codice e password non devono finire nei log nemmeno per errore (progettazione, sezione 8.9).
    @Override
    public String toString() {
        return "ResetPasswordRequest[email=" + email + "]";
    }
}

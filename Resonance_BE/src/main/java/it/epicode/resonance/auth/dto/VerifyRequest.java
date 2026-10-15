package it.epicode.resonance.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.Locale;

/**
 * Verifica dell'email (progettazione, sezioni 4.5 e 6.4): codice a 6 cifre e la password scelta nella
 * registrazione. La password non ha il minimo di 8 caratteri: una diversa e' un errore applicativo
 * (WRONG_PASSWORD), non di forma.
 */
public record VerifyRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Pattern(regexp = "\\d{6}", message = "deve essere di 6 cifre") String code,
        @NotBlank @Size(max = 72) String password
) {

    public VerifyRequest {
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }

    // Codice e password non devono finire nei log nemmeno per errore (progettazione, sezione 8.9).
    @Override
    public String toString() {
        return "VerifyRequest[email=" + email + "]";
    }
}

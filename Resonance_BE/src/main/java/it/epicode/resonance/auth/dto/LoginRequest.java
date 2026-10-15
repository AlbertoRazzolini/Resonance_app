package it.epicode.resonance.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Locale;

/**
 * Credenziali del login (progettazione, sezione 6.4). L'email si normalizza qui (spazi e maiuscole),
 * cosi' "  Mario@Example.COM " e' lo stesso utente registrato in minuscolo. La password non ha il minimo
 * di 8 caratteri: al login una password troppo corta e' semplicemente errata (401), non un errore di forma.
 */
public record LoginRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank String password
) {

    public LoginRequest {
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }

    // La password non deve finire nei log nemmeno per errore (progettazione, sezione 8.9).
    @Override
    public String toString() {
        return "LoginRequest[email=" + email + "]";
    }
}

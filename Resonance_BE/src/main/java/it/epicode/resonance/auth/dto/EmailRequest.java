package it.epicode.resonance.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Locale;

/**
 * Body del reinvio del codice e della password dimenticata (progettazione, sezione 6.4): la sola email,
 * normalizzata come nel login.
 */
public record EmailRequest(
        @NotBlank @Email @Size(max = 255) String email
) {

    public EmailRequest {
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }
}

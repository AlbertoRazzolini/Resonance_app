package it.epicode.resonance.admin.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/**
 * Richiesta di sospensione (progettazione, sezione 5.5). Il motivo e' obbligatorio; la fine e' una data futura
 * oppure una durata in giorni, al massimo una delle due: nessuna delle due = sospensione indeterminata.
 */
@SingleSuspensionLimit
public record SuspendUserRequest(
        @NotBlank @Size(min = 1, max = 500) String reason,
        @Future Instant suspendedUntil,
        @Min(1) @Max(3650) Integer durationDays
) {

    // Trim qui, prima della validazione: un motivo di soli spazi risulta vuoto e viene rifiutato.
    public SuspendUserRequest {
        reason = reason == null ? null : reason.strip();
    }
}

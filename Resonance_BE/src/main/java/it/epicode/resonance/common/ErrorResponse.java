package it.epicode.resonance.common;

import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.Map;

/**
 * Corpo di risposta di tutti gli errori HTTP (progettazione, sezione 6.1). Il frontend decide in base
 * a "code", mai al messaggio. "fields" e "details" sono sempre oggetti, vuoti quando non servono:
 * fields solo per VALIDATION_ERROR, details solo dove indicato. Mai stack trace o messaggi interni.
 */
public record ErrorResponse(
        int status,
        String code,
        String error,
        String message,
        Map<String, String> fields,
        Map<String, Object> details,
        Instant timestamp
) {

    public ErrorResponse {
        fields = fields == null ? Map.of() : Map.copyOf(fields);
        details = details == null ? Map.of() : Map.copyOf(details);
    }

    /**
     * Costruisce la risposta per un codice d'errore; status ed "error" ne derivano.
     */
    public static ErrorResponse of(ErrorCode code, String message, Map<String, String> fields,
                                   Map<String, Object> details, Instant now) {
        HttpStatus status = code.httpStatus();
        return new ErrorResponse(status.value(), code.name(), status.getReasonPhrase(), message,
                fields, details, now);
    }
}

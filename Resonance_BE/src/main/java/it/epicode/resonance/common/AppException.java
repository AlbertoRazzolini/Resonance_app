package it.epicode.resonance.common;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Eccezione applicativa: porta il codice d'errore (da cui si ricava lo stato HTTP) e, quando serve,
 * i campi non validi (solo per VALIDATION_ERROR) e dettagli aggiuntivi (es. ACCOUNT_SUSPENDED).
 */
public class AppException extends RuntimeException {

    private final ErrorCode code;
    private final Map<String, String> fields;
    private Map<String, Object> details = Map.of();

    public AppException(ErrorCode code, String message) {
        this(code, message, Map.of());
    }

    public AppException(ErrorCode code, String message, Map<String, String> fields) {
        super(message);
        this.code = code;
        this.fields = fields == null ? Map.of() : Map.copyOf(fields);
    }

    /**
     * Aggiunge i dettagli che il frontend legge nel campo "details" e restituisce la stessa
     * eccezione, cosi' si puo' scrivere: throw new AppException(...).withDetails(...).
     */
    public AppException withDetails(Map<String, Object> details) {
        // Non Map.copyOf: i dettagli possono avere valori null (es. suspendedUntil di una sospensione indeterminata).
        this.details = details == null ? Map.of() : Collections.unmodifiableMap(new LinkedHashMap<>(details));
        return this;
    }

    public ErrorCode getCode() {
        return code;
    }

    public Map<String, String> getFields() {
        return fields;
    }

    public Map<String, Object> getDetails() {
        return details;
    }
}

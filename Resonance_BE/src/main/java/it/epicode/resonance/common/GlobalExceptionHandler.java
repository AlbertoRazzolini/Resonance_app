package it.epicode.resonance.common;

import jakarta.validation.ConstraintViolationException;
import org.postgresql.util.PSQLException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Traduce ogni eccezione in un {@link ErrorResponse}: nessuna deve arrivare a /error senza passare
 * da qui, e nessuna risposta contiene stack trace o messaggi interni (progettazione, sezione 6.1).
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * Codice d'errore per nome di vincolo del database. Si aggiunge una riga quando una card
     * introduce un vincolo che ha un codice proprio (es. uq_users_email); gli altri sono CONFLICT.
     */
    private static final Map<String, ErrorCode> CODES_BY_CONSTRAINT = Map.of();

    private final Clock clock;

    public GlobalExceptionHandler(Clock clock) {
        this.clock = clock;
    }

    /**
     * Errori previsti dall'applicazione: codice, campi e dettagli arrivano dall'eccezione.
     */
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ErrorResponse> handle(AppException ex) {
        return response(ex.getCode(), ex.getMessage(), ex.getFields(), ex.getDetails());
    }

    /**
     * Body con campi non validi (@Valid): elenca ogni campo con il suo messaggio.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handle(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
                fields.put(error.getField(), error.getDefaultMessage()));
        return response(ErrorCode.VALIDATION_ERROR, "Uno o più campi non sono validi", fields, Map.of());
    }

    /**
     * Parametri di un metodo che violano un vincolo (validazione dei parametri di Spring).
     */
    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ErrorResponse> handle(HandlerMethodValidationException ex) {
        return response(ErrorCode.VALIDATION_ERROR, "Uno o più parametri non sono validi", Map.of(), Map.of());
    }

    /**
     * Violazioni sollevate dalla validazione fuori dal controller (es. in un service).
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handle(ConstraintViolationException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getConstraintViolations().forEach(violation ->
                fields.put(violation.getPropertyPath().toString(), violation.getMessage()));
        return response(ErrorCode.VALIDATION_ERROR, "Uno o più campi non sono validi", fields, Map.of());
    }

    /**
     * Body illeggibile (JSON non valido, tipo sbagliato): e' un errore di validazione, non un 500.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handle(HttpMessageNotReadableException ex) {
        return response(ErrorCode.VALIDATION_ERROR, "Corpo della richiesta non leggibile", Map.of(), Map.of());
    }

    /**
     * Parametro di tipo sbagliato (es. un id che non e' un UUID, un numero non numerico).
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handle(MethodArgumentTypeMismatchException ex) {
        return response(ErrorCode.VALIDATION_ERROR, "Il parametro '" + ex.getName() + "' non è valido",
                Map.of(), Map.of());
    }

    /**
     * Parametro obbligatorio assente: senza questo handler diventerebbe un 500.
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handle(MissingServletRequestParameterException ex) {
        return response(ErrorCode.VALIDATION_ERROR, "Il parametro '" + ex.getParameterName() + "' è obbligatorio",
                Map.of(), Map.of());
    }

    /**
     * Percorso inesistente: 404 in JSON.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handle(NoResourceFoundException ex) {
        return response(ErrorCode.NOT_FOUND, "Risorsa non trovata", Map.of(), Map.of());
    }

    /**
     * Percorso esistente ma con un altro metodo: senza questo handler specifico finirebbe nel
     * catch-all, cioe' in un 500.
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handle(HttpRequestMethodNotSupportedException ex) {
        return response(ErrorCode.METHOD_NOT_ALLOWED, "Metodo non supportato per questo percorso", Map.of(), Map.of());
    }

    /**
     * Content-Type del body non supportato (l'API accetta solo JSON): e' un errore del client e
     * senza questo handler finirebbe nel catch-all come 500 (progettazione, sezione 6.2).
     */
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handle(HttpMediaTypeNotSupportedException ex) {
        return response(ErrorCode.UNSUPPORTED_MEDIA_TYPE, "Tipo di contenuto non supportato: usa application/json",
                Map.of(), Map.of());
    }

    /**
     * Violazione di un vincolo del database: il codice dipende dal nome del vincolo.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handle(DataIntegrityViolationException ex) {
        String constraint = constraintName(ex);
        // Le mappe immutabili rifiutano la chiave nulla: il nome puo' mancare.
        ErrorCode code = constraint == null
                ? ErrorCode.CONFLICT
                : CODES_BY_CONSTRAINT.getOrDefault(constraint, ErrorCode.CONFLICT);
        return response(code, "Conflitto con lo stato attuale dei dati", Map.of(), Map.of());
    }

    /**
     * Qualsiasi altra eccezione: si scrive nel log e al client resta un messaggio generico.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handle(Exception ex) {
        log.error("Errore inatteso", ex);
        return response(ErrorCode.INTERNAL_ERROR, "Errore interno", Map.of(), Map.of());
    }

    /**
     * Nome del vincolo violato, o null se non si trova. Si legge prima il campo a parte dell'errore
     * di PostgreSQL, che non dipende dalla lingua del server: Hibernate lo cerca nel testo del
     * messaggio in inglese e con un server in un'altra lingua non lo trova.
     */
    static String constraintName(DataIntegrityViolationException ex) {
        for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
            if (cause instanceof PSQLException psqlEx
                    && psqlEx.getServerErrorMessage() != null
                    && psqlEx.getServerErrorMessage().getConstraint() != null) {
                return psqlEx.getServerErrorMessage().getConstraint();
            }
        }
        if (ex.getCause() instanceof org.hibernate.exception.ConstraintViolationException hibernateEx) {
            return hibernateEx.getConstraintName();
        }
        return null;
    }

    private ResponseEntity<ErrorResponse> response(ErrorCode code, String message, Map<String, String> fields,
                                                   Map<String, Object> details) {
        return ResponseEntity.status(code.httpStatus())
                .body(ErrorResponse.of(code, message, fields, details, clock.instant()));
    }
}

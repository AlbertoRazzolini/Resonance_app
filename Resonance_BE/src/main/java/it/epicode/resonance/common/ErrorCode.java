package it.epicode.resonance.common;

import org.springframework.http.HttpStatus;

/**
 * Catalogo dei codici d'errore stabili su cui decide il frontend (progettazione, sezione 6.2).
 * Contiene solo i codici generali: gli altri si aggiungono card per card, insieme alla funzionalita'
 * che li usa. httpStatus e' null per i codici che esistono solo sul WebSocket.
 */
public enum ErrorCode {

    VALIDATION_ERROR(HttpStatus.BAD_REQUEST),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED),
    CONFLICT(HttpStatus.CONFLICT),
    TOO_MANY_REQUESTS(HttpStatus.TOO_MANY_REQUESTS),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR);

    private final HttpStatus httpStatus;

    ErrorCode(HttpStatus httpStatus) {
        this.httpStatus = httpStatus;
    }

    /**
     * Stato HTTP della risposta, o null per i codici solo WebSocket.
     */
    public HttpStatus httpStatus() {
        return httpStatus;
    }
}

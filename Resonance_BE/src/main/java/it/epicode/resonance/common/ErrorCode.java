package it.epicode.resonance.common;

import org.springframework.http.HttpStatus;

/**
 * Catalogo dei codici d'errore stabili su cui decide il frontend (progettazione, sezione 6.2).
 * Contiene solo i codici generali: gli altri si aggiungono card per card, insieme alla funzionalita'
 * che li usa. httpStatus e' null per i codici che esistono solo sul WebSocket.
 */
public enum ErrorCode {

    VALIDATION_ERROR(HttpStatus.BAD_REQUEST),
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED),
    ACCESS_DENIED(HttpStatus.FORBIDDEN),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE),
    CONFLICT(HttpStatus.CONFLICT),
    TOO_MANY_REQUESTS(HttpStatus.TOO_MANY_REQUESTS),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED),
    EMAIL_NOT_VERIFIED(HttpStatus.FORBIDDEN),
    ACCOUNT_SUSPENDED(HttpStatus.FORBIDDEN),
    CSRF_HEADER_MISSING(HttpStatus.FORBIDDEN),
    REFRESH_TOKEN_INVALID(HttpStatus.UNAUTHORIZED),
    REFRESH_TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED),
    REFRESH_TOKEN_REUSED(HttpStatus.UNAUTHORIZED),
    REFRESH_CONFLICT(HttpStatus.CONFLICT),
    EMAIL_ALREADY_REGISTERED(HttpStatus.CONFLICT),
    DISPLAY_NAME_TAKEN(HttpStatus.CONFLICT),
    ALREADY_VERIFIED(HttpStatus.CONFLICT),
    CODE_INVALID(HttpStatus.BAD_REQUEST),
    CODE_EXPIRED(HttpStatus.BAD_REQUEST),
    WRONG_PASSWORD(HttpStatus.BAD_REQUEST),
    INSUFFICIENT_PLATFORM_LEVEL(HttpStatus.FORBIDDEN),
    LAST_SUPERADMIN(HttpStatus.CONFLICT),
    USER_NOT_VERIFIED(HttpStatus.CONFLICT),
    USER_NOT_ACTIVE(HttpStatus.CONFLICT),
    NOT_OWNER(HttpStatus.FORBIDDEN),
    ADDRESS_NOT_FOUND(HttpStatus.BAD_REQUEST),
    GEOCODING_UNAVAILABLE(HttpStatus.BAD_GATEWAY),
    EVENT_ALREADY_PUBLISHED(HttpStatus.CONFLICT),
    EVENT_DATE_PAST(HttpStatus.BAD_REQUEST),
    CONTENT_ALREADY_HIDDEN(HttpStatus.CONFLICT),
    CONTENT_NOT_HIDDEN(HttpStatus.CONFLICT),
    RESTORE_NOT_ALLOWED(HttpStatus.CONFLICT),
    CANNOT_FRIEND_SELF(HttpStatus.BAD_REQUEST),
    FRIEND_REQUEST_ALREADY_SENT(HttpStatus.CONFLICT),
    FRIEND_REQUEST_ALREADY_RECEIVED(HttpStatus.CONFLICT),
    ALREADY_FRIENDS(HttpStatus.CONFLICT),
    FRIENDSHIP_UNAVAILABLE(HttpStatus.CONFLICT),
    NOT_FRIENDSHIP_ADDRESSEE(HttpStatus.FORBIDDEN),
    NOT_FRIENDSHIP_REQUESTER(HttpStatus.FORBIDDEN),
    FRIEND_REQUEST_NOT_PENDING(HttpStatus.CONFLICT),
    NOT_FRIENDS(HttpStatus.FORBIDDEN),
    CANNOT_MESSAGE_SELF(HttpStatus.BAD_REQUEST),
    NOT_CONVERSATION_MEMBER(HttpStatus.FORBIDDEN),
    CHAT_LOCKED(HttpStatus.FORBIDDEN),
    COLLAB_CLOSED(HttpStatus.CONFLICT),
    CANNOT_APPLY_OWN_POST(HttpStatus.BAD_REQUEST),
    EVENT_CLOSED(HttpStatus.CONFLICT),
    CANNOT_CONTACT_OWN_EVENT(HttpStatus.BAD_REQUEST),
    // Solo WebSocket (sezione 7.2): sulle API il token non valido e' UNAUTHENTICATED.
    TOKEN_INVALID(null);

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

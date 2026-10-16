package it.epicode.resonance.common;

/**
 * Corpo degli errori sul WebSocket (progettazione, sezioni 7.2 e 7.4): arriva su /user/queue/errors,
 * oppure nel frame ERROR quando la connessione viene chiusa. Niente stato HTTP: il frontend decide solo
 * dal codice. Il messaggio e' sempre generico, mai un dettaglio interno.
 */
public record WsError(String code, String message) {

    /** Coda degli errori, relativa al prefisso /user (il client fa SUBSCRIBE a /user/queue/errors). */
    public static final String QUEUE = "/queue/errors";

    public static WsError of(ErrorCode code, String message) {
        return new WsError(code.name(), message);
    }
}

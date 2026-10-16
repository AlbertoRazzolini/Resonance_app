package it.epicode.resonance.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.converter.MessageConversionException;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.support.MethodArgumentNotValidException;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.web.bind.annotation.ControllerAdvice;

/**
 * Eccezioni dei metodi @MessageMapping (progettazione, sezione 7.5): l'errore va su /user/queue/errors
 * della sola sessione che ha fatto il SEND e la connessione resta aperta. E' il corrispettivo di
 * GlobalExceptionHandler per il WebSocket: mai stack trace ne' messaggi interni.
 */
@ControllerAdvice
public class WebSocketExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(WebSocketExceptionHandler.class);

    @MessageExceptionHandler(AppException.class)
    @SendToUser(destinations = WsError.QUEUE, broadcast = false)
    public WsError handle(AppException ex) {
        return WsError.of(ex.getCode(), ex.getMessage());
    }

    @MessageExceptionHandler(MethodArgumentNotValidException.class)
    @SendToUser(destinations = WsError.QUEUE, broadcast = false)
    public WsError handle(MethodArgumentNotValidException ex) {
        return WsError.of(ErrorCode.VALIDATION_ERROR, "Uno o più campi non sono validi");
    }

    @MessageExceptionHandler(MessageConversionException.class)
    @SendToUser(destinations = WsError.QUEUE, broadcast = false)
    public WsError handle(MessageConversionException ex) {
        return WsError.of(ErrorCode.VALIDATION_ERROR, "Corpo del messaggio non leggibile");
    }

    /** Ogni altra eccezione: risposta generica, dettaglio solo nel log. */
    @MessageExceptionHandler(Exception.class)
    @SendToUser(destinations = WsError.QUEUE, broadcast = false)
    public WsError handle(Exception ex) {
        log.error("Errore non gestito su un messaggio WebSocket", ex);
        return WsError.of(ErrorCode.INTERNAL_ERROR, "Errore interno del server");
    }
}

package it.epicode.resonance.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.util.MimeTypeUtils;
import org.springframework.web.socket.messaging.StompSubProtocolErrorHandler;
import tools.jackson.databind.json.JsonMapper;

/**
 * Frame ERROR mandato al client quando un suo frame fa fallire l'elaborazione (per esempio un CONNECT con
 * token non valido): dopo il frame Spring chiude la connessione. Header "message" = codice, corpo = WsError
 * (progettazione, sezione 7.2). Il gestore predefinito scriverebbe il messaggio dell'eccezione, con
 * dettagli interni.
 */
@Component
public class StompErrorHandler extends StompSubProtocolErrorHandler {

    private static final Logger log = LoggerFactory.getLogger(StompErrorHandler.class);

    /** Inizio del messaggio con cui Spring rifiuta un frame di una sessione senza CONNECT. */
    private static final String UNKNOWN_SESSION = "Unknown session";

    private final JsonMapper jsonMapper;

    public StompErrorHandler(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    @Override
    public Message<byte[]> handleClientMessageProcessingError(Message<byte[]> clientMessage, Throwable ex) {
        WsError error = toError(ex);
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.ERROR);
        accessor.setMessage(error.code());
        accessor.setContentType(MimeTypeUtils.APPLICATION_JSON);
        accessor.setLeaveMutable(true);
        StompHeaderAccessor clientAccessor = clientMessage != null
                ? MessageHeaderAccessor.getAccessor(clientMessage, StompHeaderAccessor.class)
                : null;
        return handleInternal(accessor, jsonMapper.writeValueAsBytes(error), ex, clientAccessor);
    }

    /**
     * L'AppException arriva avvolta in una MessageDeliveryException del canale: si cerca nella catena
     * delle cause. Un SEND o una SUBSCRIBE su una sessione che non ha fatto CONNECT li rifiuta Spring prima
     * dell'interceptor, con un'IllegalStateException: e' un token mancante (sezione 7.3), non un errore
     * interno. Ogni altra eccezione diventa INTERNAL_ERROR e il dettaglio resta solo nel log.
     */
    private WsError toError(Throwable ex) {
        for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
            if (cause instanceof AppException app) {
                return WsError.of(app.getCode(), app.getMessage());
            }
            if (cause instanceof IllegalStateException && String.valueOf(cause.getMessage()).startsWith(UNKNOWN_SESSION)) {
                return WsError.of(ErrorCode.TOKEN_INVALID, "Token mancante, scaduto o non valido");
            }
        }
        log.error("Errore non gestito su un frame STOMP", ex);
        return WsError.of(ErrorCode.INTERNAL_ERROR, "Errore interno del server");
    }
}

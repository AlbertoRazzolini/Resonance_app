package it.epicode.resonance.support;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import java.util.Map;

/**
 * Destinazioni /app/test/** solo per i test: servono a provare che un SEND ammesso arriva a un controller e
 * che gli errori dei controller passano da WebSocketExceptionHandler. Le destinazioni vere della chat
 * arrivano con F5-02. @TestComponent la tiene fuori dalla scansione: la registra solo chi la importa.
 */
@TestComponent
@Controller
@MessageMapping("/test")
public class StompTestController {

    public static final String SECRET_DETAIL = "dettaglio-interno-da-non-esporre";

    /** Risponde in eco al solo mittente. */
    @MessageMapping("/echo")
    @SendToUser(destinations = "/queue/messages", broadcast = false)
    public Map<String, Object> echo(Map<String, Object> body) {
        return body;
    }

    /** Errore previsto dell'applicazione. */
    @MessageMapping("/denied")
    public void denied() {
        throw new AppException(ErrorCode.ACCESS_DENIED, "Operazione non consentita");
    }

    /** Errore imprevisto, con un testo che non deve mai arrivare al client. */
    @MessageMapping("/boom")
    public void boom() {
        throw new IllegalStateException(SECRET_DETAIL);
    }
}

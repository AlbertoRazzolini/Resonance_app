package it.epicode.resonance.websocket;

import it.epicode.resonance.admin.UserSuspendedEvent;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.WsError;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Alla sospensione di un utente avvisa le sue sessioni WebSocket con ACCOUNT_SUSPENDED e le chiude
 * (progettazione, sezione 7.8). Parte solo dopo il commit: se la sospensione viene annullata non si
 * chiude nulla.
 */
@Component
public class UserSuspendedSessionCloser {

    /**
     * Pausa fra l'avviso e la chiusura: l'invio passa dai canali asincroni di Spring, una chiusura
     * immediata farebbe perdere il messaggio al client.
     */
    private static final long CLOSE_DELAY_MILLIS = 500;

    private final SimpMessagingTemplate messagingTemplate;
    private final WebSocketSessionRegistry registry;

    public UserSuspendedSessionCloser(SimpMessagingTemplate messagingTemplate, WebSocketSessionRegistry registry) {
        this.messagingTemplate = messagingTemplate;
        this.registry = registry;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onUserSuspended(UserSuspendedEvent event) {
        UUID userId = event.userId();
        if (registry.sessionCount(userId) == 0) {
            return;
        }
        messagingTemplate.convertAndSendToUser(userId.toString(), WsError.QUEUE,
                WsError.of(ErrorCode.ACCOUNT_SUSPENDED, "Account sospeso"));
        CompletableFuture.runAsync(() -> registry.closeAll(userId),
                CompletableFuture.delayedExecutor(CLOSE_DELAY_MILLIS, TimeUnit.MILLISECONDS));
    }
}

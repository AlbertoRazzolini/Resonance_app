package it.epicode.resonance.notification;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Consegna delle notifiche dopo il commit (progettazione, sezione 7.6): se la transazione fallisce non parte
 * nulla. La notifica arriva a tutte le sessioni del destinatario; chi e' offline non la riceve.
 */
@Component
public class LiveNotificationListener {

    /** Coda delle notifiche, relativa al prefisso /user (il client fa SUBSCRIBE a /user/queue/notifications). */
    static final String QUEUE = "/queue/notifications";

    private final SimpMessagingTemplate messagingTemplate;

    public LiveNotificationListener(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onNotification(LiveNotificationEvent event) {
        messagingTemplate.convertAndSendToUser(event.recipientId().toString(), QUEUE, event.notification());
    }
}

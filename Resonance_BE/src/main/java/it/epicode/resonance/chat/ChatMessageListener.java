package it.epicode.resonance.chat;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Consegna dei messaggi dopo il commit (progettazione, sezione 7.6): se la transazione fallisce non parte nulla. Il
 * messaggio arriva a tutte le sessioni dei due membri, anche a quelle del mittente in altre schede.
 */
@Component
public class ChatMessageListener {

    /** Coda dei messaggi, relativa al prefisso /user (il client fa SUBSCRIBE a /user/queue/messages). */
    static final String QUEUE = "/queue/messages";

    private final SimpMessagingTemplate messagingTemplate;

    public ChatMessageListener(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMessage(ChatMessageEvent event) {
        messagingTemplate.convertAndSendToUser(event.senderId().toString(), QUEUE, event.message());
        messagingTemplate.convertAndSendToUser(event.recipientId().toString(), QUEUE, event.message());
    }
}

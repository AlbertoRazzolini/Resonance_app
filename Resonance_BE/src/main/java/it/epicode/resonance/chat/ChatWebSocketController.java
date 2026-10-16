package it.epicode.resonance.chat;

import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.chat.dto.SendMessageRequest;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.util.UUID;

/**
 * Invio di un messaggio: SEND {@code /app/chats/{conversationId}/send} (progettazione, sezione 7.5). Nessuna risposta
 * diretta: il messaggio arriva ai due membri su {@code /user/queue/messages}, gli errori su {@code /user/queue/errors}
 * (WebSocketExceptionHandler).
 */
@Controller
public class ChatWebSocketController {

    private final ChatService chatService;

    public ChatWebSocketController(ChatService chatService) {
        this.chatService = chatService;
    }

    /**
     * Payload facoltativo e senza {@code @Valid}: un corpo vuoto o non valido e' il terzo controllo del service,
     * dopo token e limite di frequenza.
     */
    @MessageMapping("/chats/{conversationId}/send")
    public void send(@DestinationVariable UUID conversationId, @Payload(required = false) SendMessageRequest request,
                     AuthenticatedUser user) {
        chatService.send(conversationId, request, user);
    }
}

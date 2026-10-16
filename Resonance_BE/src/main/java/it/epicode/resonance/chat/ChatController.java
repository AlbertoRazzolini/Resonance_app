package it.epicode.resonance.chat;

import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.chat.dto.ConversationResponse;
import it.epicode.resonance.chat.dto.CreateConversationRequest;
import it.epicode.resonance.chat.dto.MessagePageResponse;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Endpoint REST della chat (progettazione, sezione 6.9): tutti richiedono il login; appartenenza e permessi stanno
 * nel service. L'invio dei messaggi non e' REST: passa dal WebSocket.
 */
@RestController
@RequestMapping("/api/chats")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    /**
     * Le conversazioni dell'utente, dall'ultima attivita', con ultimo messaggio, non letti e {@code canSend}.
     */
    @GetMapping
    public PageResponse<ConversationResponse> list(@AuthenticationPrincipal AuthenticatedUser user,
                                                   @Valid PageParams params) {
        return chatService.list(user.id(), params);
    }

    /**
     * Trova o crea la conversazione con un altro utente: 200 con la conversazione.
     */
    @PostMapping
    public ConversationResponse open(@AuthenticationPrincipal AuthenticatedUser user,
                                     @Valid @RequestBody CreateConversationRequest request) {
        return chatService.findOrCreate(user.id(), request.recipientId());
    }

    /**
     * Storico a cursore: {@code before} e' l'id del messaggio piu' vecchio gia' caricato, {@code size} da 1 a 100.
     */
    @GetMapping("/{id}/messages")
    public MessagePageResponse messages(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id,
                                        @RequestParam(required = false) UUID before,
                                        @RequestParam(defaultValue = "30") @Min(1) @Max(100) int size) {
        return chatService.messages(user.id(), id, before, size);
    }

    /**
     * Segna come letti i messaggi dell'altro membro.
     */
    @PatchMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void read(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        chatService.markRead(user.id(), id);
    }
}

package it.epicode.resonance.friendship;

import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.friendship.dto.FriendRequest;
import it.epicode.resonance.friendship.dto.FriendshipListType;
import it.epicode.resonance.friendship.dto.FriendshipResponse;
import it.epicode.resonance.friendship.dto.FriendshipSummary;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Endpoint delle amicizie (progettazione, sezione 6.14): tutti richiedono il login; permessi e 404 per chi non e'
 * coinvolto stanno nel service.
 */
@RestController
@RequestMapping("/api/friendships")
public class FriendshipController {

    private final FriendshipService friendshipService;

    public FriendshipController(FriendshipService friendshipService) {
        this.friendshipService = friendshipService;
    }

    /**
     * Chiede l'amicizia a un utente: 201 con l'amicizia vista dal chiamante (di norma OUTGOING).
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FriendshipResponse request(@AuthenticationPrincipal AuthenticatedUser user,
                                      @Valid @RequestBody FriendRequest request) {
        return friendshipService.request(user.id(), request.userId());
    }

    /**
     * Elenco paginato per tipo: {@code type} e' obbligatorio (FRIENDS, INCOMING, OUTGOING); se manca o e'
     * sconosciuto e' un 400.
     */
    @GetMapping
    public PageResponse<FriendshipResponse> list(@AuthenticationPrincipal AuthenticatedUser user,
                                                 @RequestParam FriendshipListType type,
                                                 @Valid PageParams params) {
        return friendshipService.list(user.id(), type, params);
    }

    /**
     * Stato dell'amicizia del chiamante con un utente, per il bottone sul profilo: {@code {status, friendshipId}}.
     */
    @GetMapping("/with/{userId}")
    public FriendshipSummary stateWith(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID userId) {
        return friendshipService.stateWith(user.id(), userId);
    }

    /**
     * Accetta una richiesta ricevuta (solo il destinatario): 200 con l'amicizia, ormai FRIENDS.
     */
    @PostMapping("/{id}/accept")
    public FriendshipResponse accept(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        return friendshipService.accept(user.id(), id);
    }

    /**
     * Rifiuta in silenzio una richiesta ricevuta (solo il destinatario).
     */
    @PostMapping("/{id}/decline")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void decline(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        friendshipService.decline(user.id(), id);
    }

    /**
     * Annulla una richiesta inviata (solo il richiedente).
     */
    @PostMapping("/{id}/cancel")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        friendshipService.cancel(user.id(), id);
    }

    /**
     * Rimuove un'amicizia (una delle due parti).
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        friendshipService.remove(user.id(), id);
    }
}

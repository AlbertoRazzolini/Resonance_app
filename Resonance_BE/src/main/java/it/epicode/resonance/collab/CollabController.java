package it.epicode.resonance.collab;

import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.collab.dto.CollabPostResponse;
import it.epicode.resonance.collab.dto.CreateCollabPostRequest;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.moderation.dto.OwnerDeleteRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Endpoint degli annunci di collaborazione (progettazione, sezione 6.7). La creazione e' riservata ai MUSICIAN
 * da {@code SecurityConfig}; lista e dettaglio sono pubblici; chiusura e cancellazione spettano al proprietario.
 */
@RestController
@RequestMapping("/api/collab-posts")
public class CollabController {

    private final CollabService collabService;

    public CollabController(CollabService collabService) {
        this.collabService = collabService;
    }

    /**
     * Crea un annuncio di collaborazione del chiamante.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CollabPostResponse create(@AuthenticationPrincipal AuthenticatedUser user,
                                     @Valid @RequestBody CreateCollabPostRequest request) {
        return collabService.create(user.id(), request);
    }

    /**
     * Lista pubblica degli annunci aperti e non nascosti, dal piu' recente.
     */
    @GetMapping
    public PageResponse<CollabPostResponse> list(@Valid PageParams params) {
        return collabService.list(params);
    }

    /**
     * Dettaglio pubblico, anche di un annuncio chiuso; 404 se e' nascosto.
     */
    @GetMapping("/{id}")
    public CollabPostResponse get(@PathVariable UUID id) {
        return collabService.get(id);
    }

    /**
     * Chiude l'annuncio del chiamante (idempotente).
     */
    @PatchMapping("/{id}/close")
    public CollabPostResponse close(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser user) {
        return collabService.close(id, user.id());
    }

    /**
     * Cancellazione del proprietario (sezione 5.7), con motivo facoltativo nel body.
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser user,
                       @Valid @RequestBody(required = false) OwnerDeleteRequest request) {
        collabService.delete(id, request == null ? null : request.reason(), user.id());
    }
}

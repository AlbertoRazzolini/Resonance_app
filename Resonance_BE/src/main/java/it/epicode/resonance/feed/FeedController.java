package it.epicode.resonance.feed;

import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.feed.dto.CreateFeedPostRequest;
import it.epicode.resonance.feed.dto.FeedPostResponse;
import it.epicode.resonance.feed.dto.LikeStatusResponse;
import it.epicode.resonance.moderation.dto.OwnerDeleteRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Endpoint del feed (progettazione, sezione 6.8). Lista e dettaglio sono pubblici; creazione, like e
 * cancellazione richiedono il login e la cancellazione e' del proprietario.
 */
@RestController
@RequestMapping("/api/feed-posts")
public class FeedController {

    private final FeedService feedService;

    public FeedController(FeedService feedService) {
        this.feedService = feedService;
    }

    /**
     * Pubblica un post del chiamante.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FeedPostResponse create(@AuthenticationPrincipal AuthenticatedUser user,
                                   @Valid @RequestBody CreateFeedPostRequest request) {
        return feedService.create(user.id(), request);
    }

    /**
     * Lista pubblica dal piu' recente, con filtro per raggio facoltativo (lat, lng e radiusKm tutti o nessuno,
     * sezione 10.2). {@code likedByMe} si calcola solo se il chiamante e' autenticato.
     */
    @GetMapping
    public PageResponse<FeedPostResponse> list(@RequestParam(required = false) Double lat,
                                               @RequestParam(required = false) Double lng,
                                               @RequestParam(required = false) Double radiusKm,
                                               @Valid PageParams params,
                                               @AuthenticationPrincipal AuthenticatedUser user) {
        return feedService.list(lat, lng, radiusKm, params, viewerId(user));
    }

    /**
     * Dettaglio pubblico; 404 se il post e' nascosto.
     */
    @GetMapping("/{id}")
    public FeedPostResponse get(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser user) {
        return feedService.get(id, viewerId(user));
    }

    /**
     * Cancellazione del proprietario (sezione 5.7), con motivo facoltativo nel body.
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser user,
                       @Valid @RequestBody(required = false) OwnerDeleteRequest request) {
        feedService.delete(id, request == null ? null : request.reason(), user.id());
    }

    /**
     * Mette like al post (idempotente): restituisce il contatore aggiornato e {@code likedByMe = true}.
     */
    @PutMapping("/{id}/like")
    public LikeStatusResponse like(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser user) {
        return feedService.like(id, user.id());
    }

    /**
     * Toglie il like al post (idempotente): restituisce il contatore aggiornato e {@code likedByMe = false}.
     */
    @DeleteMapping("/{id}/like")
    public LikeStatusResponse unlike(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser user) {
        return feedService.unlike(id, user.id());
    }

    /**
     * Id del chiamante, o null se la richiesta e' anonima (endpoint pubblici).
     */
    private static UUID viewerId(AuthenticatedUser user) {
        return user == null ? null : user.id();
    }
}

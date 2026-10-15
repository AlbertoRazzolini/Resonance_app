package it.epicode.resonance.event;

import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.event.dto.CreateIndieEventRequest;
import it.epicode.resonance.event.dto.IndieEventResponse;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.geo.NearbyQuery;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Endpoint degli indie event (progettazione, sezione 6.6). La creazione e' riservata ai MUSICIAN da
 * {@code SecurityConfig}; ricerca e dettaglio sono pubblici, con le bozze visibili solo al proprietario.
 */
@RestController
@RequestMapping("/api/indie-events")
public class IndieEventController {

    private final IndieEventService eventService;

    public IndieEventController(IndieEventService eventService) {
        this.eventService = eventService;
    }

    /**
     * Crea un indie event (pubblicato o bozza): l'indirizzo viene geocodificato (sezione 10.1).
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public IndieEventResponse create(@AuthenticationPrincipal AuthenticatedUser user,
                                     @Valid @RequestBody CreateIndieEventRequest request) {
        return eventService.create(user.id(), request);
    }

    /**
     * Ricerca pubblica nelle vicinanze (sezione 10.2): centro e raggio vengono sempre dalla richiesta. Solo
     * eventi pubblicati, futuri e non nascosti, dal piu' vicino.
     */
    @GetMapping("/nearby")
    public PageResponse<IndieEventResponse> nearby(@RequestParam double lat, @RequestParam double lng,
                                                   @RequestParam double radiusKm, @Valid PageParams params) {
        return eventService.nearby(new NearbyQuery(lat, lng, radiusKm), params);
    }

    /**
     * Eventi del chiamante, bozze comprese.
     */
    @GetMapping("/mine")
    public PageResponse<IndieEventResponse> mine(@AuthenticationPrincipal AuthenticatedUser user,
                                                 @Valid PageParams params) {
        return eventService.mine(user.id(), params);
    }

    /**
     * Dettaglio pubblico: 404 se l'evento non esiste, e' nascosto o e' una bozza di un altro. Il chiamante
     * puo' essere anonimo ({@code user} null).
     */
    @GetMapping("/{id}")
    public IndieEventResponse get(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser user) {
        return eventService.get(id, user == null ? null : user.id());
    }

    /**
     * Pubblica una bozza del chiamante.
     */
    @PatchMapping("/{id}/publish")
    public IndieEventResponse publish(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser user) {
        return eventService.publish(id, user.id());
    }

    /**
     * Cancellazione del proprietario (sezione 5.7), con motivo facoltativo nel body.
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser user,
                       @Valid @RequestBody(required = false) OwnerDeleteRequest request) {
        eventService.delete(id, request == null ? null : request.reason(), user.id());
    }
}

package it.epicode.resonance.event;

import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.event.dto.CreateOfficialConcertRequest;
import it.epicode.resonance.event.dto.OfficialConcertResponse;
import it.epicode.resonance.geo.NearbyQuery;
import it.epicode.resonance.moderation.dto.OwnerDeleteRequest;
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
 * Endpoint dei concerti ufficiali (progettazione, sezione 6.6). La creazione e' riservata agli HOST da
 * {@code SecurityConfig}; dettaglio e ricerca sono pubblici.
 */
@RestController
@RequestMapping("/api/official-concerts")
public class OfficialConcertController {

    private final OfficialConcertService concertService;

    public OfficialConcertController(OfficialConcertService concertService) {
        this.concertService = concertService;
    }

    /**
     * Pubblica un concerto: l'indirizzo viene geocodificato (sezione 10.1).
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OfficialConcertResponse create(@AuthenticationPrincipal AuthenticatedUser user,
                                          @Valid @RequestBody CreateOfficialConcertRequest request) {
        return concertService.create(user.id(), request);
    }

    /**
     * Ricerca pubblica nelle vicinanze (sezione 10.2): centro e raggio vengono sempre dalla richiesta, mai dal
     * profilo. Solo concerti futuri e non nascosti, dal piu' vicino.
     */
    @GetMapping("/nearby")
    public PageResponse<OfficialConcertResponse> nearby(@RequestParam double lat, @RequestParam double lng,
                                                        @RequestParam double radiusKm, @Valid PageParams params) {
        return concertService.nearby(new NearbyQuery(lat, lng, radiusKm), params);
    }

    /**
     * Dettaglio pubblico: 404 se il concerto non esiste o e' nascosto.
     */
    @GetMapping("/{id}")
    public OfficialConcertResponse get(@PathVariable UUID id) {
        return concertService.get(id);
    }

    /**
     * Cancellazione del proprietario (sezione 5.7), con motivo facoltativo nel body.
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser user,
                       @Valid @RequestBody(required = false) OwnerDeleteRequest request) {
        concertService.delete(id, request == null ? null : request.reason(), user.id());
    }
}

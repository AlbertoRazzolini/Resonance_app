package it.epicode.resonance.event;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.event.dto.CreateIndieEventRequest;
import it.epicode.resonance.event.dto.IndieEventResponse;
import it.epicode.resonance.geo.GeoPoint;
import it.epicode.resonance.geo.GeocodingService;
import it.epicode.resonance.geo.NearbyQuery;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Indie event (progettazione, sezioni 5.7, 6.6, 10.1 e 10.2): creazione con geocodifica, bozze e pubblicazione,
 * elenco personale, ricerca nelle vicinanze e cancellazione del proprietario.
 */
@Service
public class IndieEventService {

    private final IndieEventRepository events;
    private final UserRepository users;
    private final GeocodingService geocoding;
    private final TransactionTemplate transactions;
    private final Clock clock;

    public IndieEventService(IndieEventRepository events, UserRepository users, GeocodingService geocoding,
                             TransactionTemplate transactions, Clock clock) {
        this.events = events;
        this.users = users;
        this.geocoding = geocoding;
        this.transactions = transactions;
        this.clock = clock;
    }

    /**
     * Crea un indie event, pubblicato o in bozza. Come per i concerti il metodo non e' transazionale di
     * proposito: la geocodifica e' una chiamata di rete e non deve tenere occupata una connessione al database
     * (progettazione, sezione 10.1); la transazione si apre solo per il salvataggio.
     */
    public IndieEventResponse create(UUID musicianId, CreateIndieEventRequest request) {
        GeoPoint point = geocoding.geocode(request.address());
        return transactions.execute(status -> save(musicianId, request, point));
    }

    /**
     * Dettaglio. Un evento nascosto e' un 404 per tutti (sezione 3.5); una bozza e' un 404 per chiunque non sia
     * il proprietario, anonimi compresi, cosi' non rivela di esistere (sezione 6.6). {@code viewerId} e' null
     * per chi non ha fatto il login.
     */
    @Transactional(readOnly = true)
    public IndieEventResponse get(UUID id, UUID viewerId) {
        return IndieEventResponse.from(findViewable(id, viewerId), null);
    }

    /**
     * Eventi del chiamante, bozze e pubblicati, passati compresi, dal piu' recente; i nascosti no (sezione 6.6).
     */
    @Transactional(readOnly = true)
    public PageResponse<IndieEventResponse> mine(UUID userId, PageParams params) {
        Sort order = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
        Page<IndieEvent> page = events.findByMusicianIdAndModerationHiddenAtIsNull(userId,
                params.toPageable(order));
        return PageResponse.from(page.map(event -> IndieEventResponse.from(event, null)));
    }

    /**
     * Pubblica una bozza (sezione 6.6). Solo il proprietario la vede, quindi per gli altri e' un 404; una
     * bozza gia' pubblicata e' un 409 e una con la data ormai passata un 400, deciso dal Clock
     * dell'applicazione.
     */
    @Transactional
    public IndieEventResponse publish(UUID id, UUID userId) {
        IndieEvent event = findViewable(id, userId);
        requireOwner(event, userId);
        if (event.getStatus() == IndieEventStatus.PUBLISHED) {
            throw new AppException(ErrorCode.EVENT_ALREADY_PUBLISHED, "L'evento e' gia' pubblicato");
        }
        if (event.getEventDate().isBefore(clock.instant())) {
            throw new AppException(ErrorCode.EVENT_DATE_PAST, "La data dell'evento e' gia' passata",
                    Map.of("eventDate", "deve essere futura per pubblicare"));
        }
        event.setStatus(IndieEventStatus.PUBLISHED);
        return IndieEventResponse.from(event, null);
    }

    /**
     * Eventi pubblicati, futuri e non nascosti entro il raggio, dal piu' vicino (progettazione, sezione 10.2).
     * Stessa tecnica dei concerti: la query nativa restituisce id e distanza della pagina, gli eventi e i loro
     * autori si caricano con una seconda query e si rimettono nell'ordine della prima.
     */
    @Transactional(readOnly = true)
    public PageResponse<IndieEventResponse> nearby(NearbyQuery query, PageParams params) {
        Instant now = clock.instant();
        long offset = (long) params.page() * params.size();
        List<IndieEventRepository.NearbyRow> rows = events.findNearby(query.lat(), query.lng(),
                query.radiusKm(), query.minLat(), query.maxLat(), query.minLng(), query.maxLng(), now,
                params.size(), offset);
        long total = events.countNearby(query.lat(), query.lng(), query.radiusKm(), query.minLat(),
                query.maxLat(), query.minLng(), query.maxLng(), now);

        List<UUID> ids = rows.stream().map(IndieEventRepository.NearbyRow::getId).toList();
        Map<UUID, IndieEvent> byId = events.findByIdIn(ids).stream()
                .collect(Collectors.toMap(IndieEvent::getId, Function.identity()));
        // Un evento nascosto fra le due query e' gia' fuori dalla pagina: lo si salta.
        List<IndieEventResponse> content = rows.stream()
                .filter(row -> byId.containsKey(row.getId()))
                .map(row -> IndieEventResponse.from(byId.get(row.getId()), row.getDistanceKm()))
                .toList();
        return PageResponse.from(new PageImpl<>(content, params.toPageable(Sort.unsorted()), total));
    }

    /**
     * Cancellazione del proprietario (progettazione, sezione 5.7): nasconde l'evento, bozza compresa, con il
     * motivo facoltativo. Un evento nascosto o una bozza altrui sono un 404; per un evento pubblicato altrui
     * (admin compresi, che moderano con gli endpoint dedicati) NOT_OWNER.
     */
    @Transactional
    public void delete(UUID id, String reason, UUID userId) {
        IndieEvent event = findViewable(id, userId);
        requireOwner(event, userId);
        event.getModeration().hide(userId, reason, clock.instant());
    }

    private IndieEventResponse save(UUID musicianId, CreateIndieEventRequest request, GeoPoint point) {
        User musician = users.findById(musicianId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Utente non trovato"));
        IndieEvent event = new IndieEvent(musician, request.title(), request.venueName(), request.address(),
                point.latitude(), point.longitude(), request.eventDate());
        event.setDescription(request.description());
        event.setGenreTags(request.genreTags());
        event.setCoverImageUrl(request.coverImageUrl());
        event.setFree(Boolean.TRUE.equals(request.isFree()));
        if (request.status() != null) {
            event.setStatus(request.status());
        }
        return IndieEventResponse.from(events.saveAndFlush(event), null);
    }

    /**
     * Evento che {@code viewerId} puo' vedere: non nascosto e, se bozza, di sua proprieta'. Altrimenti 404.
     */
    private IndieEvent findViewable(UUID id, UUID viewerId) {
        IndieEvent event = events.findWithMusicianById(id)
                .filter(found -> !found.getModeration().isHidden())
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Evento non trovato"));
        boolean owner = viewerId != null && event.getMusician().getId().equals(viewerId);
        if (event.getStatus() == IndieEventStatus.DRAFT && !owner) {
            throw new AppException(ErrorCode.NOT_FOUND, "Evento non trovato");
        }
        return event;
    }

    private void requireOwner(IndieEvent event, UUID userId) {
        if (!event.getMusician().getId().equals(userId)) {
            throw new AppException(ErrorCode.NOT_OWNER, "Non sei il proprietario di questo evento");
        }
    }
}

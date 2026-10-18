package it.epicode.resonance.event;

import it.epicode.resonance.auth.AccessStatus;
import it.epicode.resonance.auth.UserAccessService;
import it.epicode.resonance.chat.ChatUnlockSource;
import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.event.dto.ContactResponse;
import it.epicode.resonance.event.dto.CreateOfficialConcertRequest;
import it.epicode.resonance.event.dto.OfficialConcertResponse;
import it.epicode.resonance.geo.GeoPoint;
import it.epicode.resonance.geo.GeocodingService;
import it.epicode.resonance.geo.NearbyQuery;
import it.epicode.resonance.geo.NearbyRow;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
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
 * Concerti ufficiali (progettazione, sezioni 5.7, 6.6, 10.1 e 10.2): creazione con geocodifica, dettaglio,
 * ricerca nelle vicinanze, cancellazione del proprietario e contatto dell'organizzatore.
 */
@Service
public class OfficialConcertService {

    private final OfficialConcertRepository concerts;
    private final UserRepository users;
    private final GeocodingService geocoding;
    private final TransactionTemplate transactions;
    private final UserAccessService userAccess;
    private final EventContactService contacts;
    private final Clock clock;

    public OfficialConcertService(OfficialConcertRepository concerts, UserRepository users,
                                  GeocodingService geocoding, TransactionTemplate transactions,
                                  UserAccessService userAccess, EventContactService contacts, Clock clock) {
        this.concerts = concerts;
        this.users = users;
        this.geocoding = geocoding;
        this.transactions = transactions;
        this.userAccess = userAccess;
        this.contacts = contacts;
        this.clock = clock;
    }

    /**
     * Crea un concerto. Il metodo non e' transazionale di proposito: la geocodifica e' una chiamata di rete
     * e non deve tenere occupata una connessione al database (progettazione, sezione 10.1); la transazione
     * si apre solo per il salvataggio. Se la geocodifica fallisce non si salva nulla.
     */
    public OfficialConcertResponse create(UUID hostId, CreateOfficialConcertRequest request) {
        GeoPoint point = geocoding.geocode(request.address());
        return transactions.execute(status -> save(hostId, request, point));
    }

    /**
     * Dettaglio pubblico. Un concerto nascosto e' un 404 per tutti (progettazione, sezione 3.5).
     */
    @Transactional(readOnly = true)
    public OfficialConcertResponse get(UUID id) {
        return OfficialConcertResponse.from(findVisible(id), null);
    }

    /**
     * Concerti futuri e non nascosti entro il raggio, dal piu' vicino (progettazione, sezione 10.2). La query
     * nativa restituisce solo id e distanza della pagina; i concerti e i loro autori si caricano con una
     * seconda query e si rimettono nell'ordine della prima.
     */
    @Transactional(readOnly = true)
    public PageResponse<OfficialConcertResponse> nearby(NearbyQuery query, PageParams params) {
        Instant now = clock.instant();
        long offset = (long) params.page() * params.size();
        List<NearbyRow> rows = concerts.findNearby(query.lat(), query.lng(),
                query.radiusKm(), query.minLat(), query.maxLat(), query.minLng(), query.maxLng(), now,
                params.size(), offset);
        long total = concerts.countNearby(query.lat(), query.lng(), query.radiusKm(), query.minLat(),
                query.maxLat(), query.minLng(), query.maxLng(), now);

        List<UUID> ids = rows.stream().map(NearbyRow::getId).toList();
        Map<UUID, OfficialConcert> byId = concerts.findByIdIn(ids).stream()
                .collect(Collectors.toMap(OfficialConcert::getId, Function.identity()));
        // Un concerto nascosto fra le due query e' gia' fuori dalla pagina: lo si salta.
        List<OfficialConcertResponse> content = rows.stream()
                .filter(row -> byId.containsKey(row.getId()))
                .map(row -> OfficialConcertResponse.from(byId.get(row.getId()), row.getDistanceKm()))
                .toList();
        return PageResponse.from(new PageImpl<>(content, params.toPageable(Sort.unsorted()), total));
    }

    /**
     * Cancellazione del proprietario (progettazione, sezione 5.7): nasconde il concerto con il motivo,
     * facoltativo. Un concerto gia' nascosto e' un 404 anche per chi lo aveva cancellato; chi non e' il
     * proprietario riceve NOT_OWNER, admin compresi (loro moderano con gli endpoint dedicati).
     */
    @Transactional
    public void delete(UUID id, String reason, UUID userId) {
        OfficialConcert concert = findVisible(id);
        if (!concert.getHost().getId().equals(userId)) {
            throw new AppException(ErrorCode.NOT_OWNER, "Non sei il proprietario di questo concerto");
        }
        concert.getModeration().hide(userId, reason, clock.instant());
    }

    /**
     * Contatta l'organizzatore del concerto (sezione 6.6). Un concerto nascosto, o con l'organizzatore sospeso o
     * non verificato, e' un 404 con lo stesso messaggio: la sospensione non si rivela (decisioni 66 e 69). I
     * controlli successivi e la chat sono di {@link EventContactService}.
     */
    @Transactional
    public ContactResponse contact(UUID id, UUID callerId, String message) {
        OfficialConcert concert = findVisible(id);
        User host = concert.getHost();
        if (userAccess.resolve(host.getId()).status() != AccessStatus.ACTIVE) {
            throw new AppException(ErrorCode.NOT_FOUND, "Concerto non trovato");
        }
        return contacts.contact(new EventContactService.Target(ChatUnlockSource.OFFICIAL_CONCERT, id,
                concert.getTitle(), host, concert.getEventDate()), callerId, message);
    }

    private OfficialConcertResponse save(UUID hostId, CreateOfficialConcertRequest request, GeoPoint point) {
        User host = users.findById(hostId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Utente non trovato"));
        OfficialConcert concert = new OfficialConcert(host, request.title(), request.venueName(),
                request.address(), point.latitude(), point.longitude(), request.eventDate());
        concert.setDescription(request.description());
        concert.setGenreTags(request.genreTags());
        concert.setCoverImageUrl(request.coverImageUrl());
        concert.setExternalTicketUrl(request.externalTicketUrl());
        return OfficialConcertResponse.from(concerts.saveAndFlush(concert), null);
    }

    private OfficialConcert findVisible(UUID id) {
        return concerts.findWithHostById(id)
                .filter(concert -> !concert.getModeration().isHidden())
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Concerto non trovato"));
    }
}

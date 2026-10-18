package it.epicode.resonance.geo;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Geocodifica con Nominatim (progettazione, sezione 10.1): una richiesta al secondo per rispettare la policy
 * del servizio pubblico, User-Agent identificativo e timeout brevi. Nel profilo test lo sostituisce lo stub.
 */
@Service
public class NominatimGeocodingService implements GeocodingService {

    private static final Logger log = LoggerFactory.getLogger(NominatimGeocodingService.class);

    private static final Duration MIN_INTERVAL = Duration.ofSeconds(1);
    private static final ParameterizedTypeReference<List<Place>> PLACES = new ParameterizedTypeReference<>() {
    };

    /** Pausa iniettabile: i test registrano l'attesa invece di dormire davvero. */
    @FunctionalInterface
    interface Pause {
        void sleep(Duration duration) throws InterruptedException;
    }

    private final RestClient restClient;
    private final String userAgent;
    private final Clock clock;
    private final Pause pause;
    private final Duration maxWait;
    // Un solo lock per tutte le chiamate: chi arriva prima del secondo attende il proprio turno (una sola
    // istanza dell'applicazione, progettazione sezione 10.1). Resta preso anche durante la richiesta HTTP.
    // L'attesa e' limitata da app.geocoding.max-wait: senza, le creazioni in coda occuperebbero tutti i thread
    // di Tomcat e fermerebbero il servizio (decisione 76, S3).
    private final ReentrantLock turn = new ReentrantLock();
    private Instant lastRequestAt;

    @Autowired
    public NominatimGeocodingService(@Value("${app.geocoding.url}") String url,
                                     @Value("${app.geocoding.contact}") String contact,
                                     @Value("${app.geocoding.connect-timeout}") Duration connectTimeout,
                                     @Value("${app.geocoding.read-timeout}") Duration readTimeout,
                                     @Value("${app.geocoding.max-wait}") Duration maxWait,
                                     Clock clock) {
        this(RestClient.builder().requestFactory(requestFactory(connectTimeout, readTimeout)), url, contact,
                clock, maxWait, duration -> Thread.sleep(duration));
    }

    // Per i test: un builder legato a MockRestServiceServer, orologio e pausa finti.
    NominatimGeocodingService(RestClient.Builder builder, String url, String contact, Clock clock, Duration maxWait,
                              Pause pause) {
        this.restClient = builder.baseUrl(url).build();
        this.userAgent = contact == null || contact.isBlank()
                ? "Resonance/1.0"
                : "Resonance/1.0 (" + contact.strip() + ")";
        this.clock = clock;
        this.pause = pause;
        this.maxWait = maxWait;
    }

    private static JdkClientHttpRequestFactory requestFactory(Duration connectTimeout, Duration readTimeout) {
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(connectTimeout).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(readTimeout);
        return factory;
    }

    @Override
    public GeoPoint geocode(String address) {
        if (address == null || address.isBlank()) {
            throw addressNotFound();
        }
        acquireTurn();
        try {
            waitForTurn();
            List<Place> places = search(address.strip());
            if (places == null || places.isEmpty()) {
                throw addressNotFound();
            }
            return toPoint(places.get(0));
        } finally {
            turn.unlock();
        }
    }

    // Attende il turno al massimo maxWait: oltre, 502 senza chiamare Nominatim (decisione 55 e 76).
    private void acquireTurn() {
        try {
            if (!turn.tryLock(maxWait.toNanos(), TimeUnit.NANOSECONDS)) {
                throw unavailable("attesa del turno scaduta");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw unavailable("attesa interrotta");
        }
    }

    // Se la richiesta precedente e' piu' vicina di un secondo, aspetta solo il tempo che manca.
    private void waitForTurn() {
        Instant now = clock.instant();
        if (lastRequestAt != null) {
            Duration remaining = MIN_INTERVAL.minus(Duration.between(lastRequestAt, now));
            if (remaining.isPositive()) {
                try {
                    pause.sleep(remaining);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw unavailable("attesa interrotta");
                }
            }
        }
        // L'istante si prende dopo l'attesa: il secondo si conta dall'inizio della richiesta effettiva.
        lastRequestAt = clock.instant();
    }

    private List<Place> search(String address) {
        try {
            return restClient.get()
                    .uri("/search?q={q}&format=jsonv2&limit=1", address)
                    .header("User-Agent", userAgent)
                    .header("Accept-Language", "it")
                    .retrieve()
                    .body(PLACES);
        } catch (RestClientException e) {
            // Timeout, rete, 429, 5xx o corpo non leggibile. Nel log solo tipo e stato: l'indirizzo e' un dato
            // dell'utente e il messaggio dell'eccezione puo' riportarlo.
            String status = e instanceof RestClientResponseException response
                    ? String.valueOf(response.getStatusCode().value())
                    : "nessuno";
            throw unavailable(e.getClass().getSimpleName() + ", stato HTTP " + status);
        }
    }

    private GeoPoint toPoint(Place place) {
        try {
            return new GeoPoint(Double.parseDouble(place.lat()), Double.parseDouble(place.lon()));
        } catch (NumberFormatException | NullPointerException e) {
            throw unavailable("coordinate non leggibili");
        }
    }

    private static AppException addressNotFound() {
        return new AppException(ErrorCode.ADDRESS_NOT_FOUND, "Indirizzo non trovato",
                Map.of("address", "Indirizzo non trovato"));
    }

    private static AppException unavailable(String reason) {
        log.warn("Geocodifica non disponibile: {}", reason);
        return new AppException(ErrorCode.GEOCODING_UNAVAILABLE, "Servizio di geocodifica non disponibile");
    }

    // --- JSON di /search (solo i campi usati; Nominatim li restituisce come stringhe) ---

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Place(String lat, String lon) {
    }
}

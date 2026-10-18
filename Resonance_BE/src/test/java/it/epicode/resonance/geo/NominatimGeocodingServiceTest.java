package it.epicode.resonance.geo;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.support.MutableClock;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.offset;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.client.ExpectedCount.never;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Client Nominatim (progettazione, sezione 10.1) con un server HTTP finto: risultato, indirizzo non trovato,
 * servizio non disponibile in tutte le sue forme, header della richiesta e turno di un secondo fra due chiamate,
 * provato con un orologio e una pausa finti (nessuna attesa reale).
 */
class NominatimGeocodingServiceTest {

    private static final String URL = "https://nominatim.test";
    private static final String ADDRESS = "Piazza della Signoria, Firenze";
    // Il matcher confronta il parametro grezzo: spazio e virgola devono arrivare codificati.
    private static final String ENCODED_ADDRESS = "Piazza%20della%20Signoria%2C%20Firenze";
    private static final String FOUND = "[{\"place_id\":1,\"lat\":\"43.7696\",\"lon\":\"11.2558\",\"display_name\":\"x\"}]";

    private static final Duration MAX_WAIT = Duration.ofMillis(200);

    private MockRestServiceServer server;
    private RestClient.Builder builder;
    private MutableClock clock;
    private final List<Duration> pauses = new ArrayList<>();

    @BeforeEach
    void setUp() {
        builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        clock = new MutableClock(Instant.parse("2026-10-16T10:00:00Z"));
    }

    @AfterEach
    void clearInterruptFlag() {
        // Il test di interruzione lascia il flag acceso: non deve passare al test successivo.
        Thread.interrupted();
    }

    @Test
    void geocode_returnsTheCoordinatesOfTheFirstResult() {
        server.expect(requestTo(startsWith(URL + "/search?")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("q", ENCODED_ADDRESS))
                .andRespond(withSuccess(FOUND, MediaType.APPLICATION_JSON));

        GeoPoint point = service("info@resonance.test").geocode(ADDRESS);

        assertThat(point.latitude()).isCloseTo(43.7696, offset(1e-9));
        assertThat(point.longitude()).isCloseTo(11.2558, offset(1e-9));
        server.verify();
    }

    @Test
    void geocode_sendsTheIdentifyingUserAgentAndItalianLanguage() {
        server.expect(requestTo(startsWith(URL + "/search?")))
                .andExpect(header("User-Agent", "Resonance/1.0 (info@resonance.test)"))
                .andExpect(header("Accept-Language", "it"))
                .andExpect(queryParam("q", ENCODED_ADDRESS))
                .andExpect(queryParam("format", "jsonv2"))
                .andExpect(queryParam("limit", "1"))
                .andRespond(withSuccess(FOUND, MediaType.APPLICATION_JSON));

        service("info@resonance.test").geocode(ADDRESS);

        server.verify();
    }

    @Test
    void geocode_withoutContact_sendsTheUserAgentWithoutParentheses() {
        server.expect(requestTo(URL + "/search?q=Roma&format=jsonv2&limit=1"))
                .andExpect(header("User-Agent", "Resonance/1.0"))
                .andRespond(withSuccess(FOUND, MediaType.APPLICATION_JSON));

        service("").geocode("Roma");

        server.verify();
    }

    @Test
    void geocode_withAnEmptyList_throwsAddressNotFoundOnTheAddressField() {
        server.expect(requestTo(URL + "/search?q=zzzz&format=jsonv2&limit=1"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> service("info@resonance.test").geocode("zzzz"))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getCode()).isEqualTo(ErrorCode.ADDRESS_NOT_FOUND);
                    assertThat(e.getFields()).containsKey("address");
                });
    }

    @Test
    void geocode_withABlankAddress_throwsAddressNotFoundWithoutCallingNominatim() {
        server.expect(never(), requestTo(URL + "/search")).andRespond(withSuccess());

        assertThatThrownBy(() -> service("info@resonance.test").geocode("   "))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.ADDRESS_NOT_FOUND));
        assertThatThrownBy(() -> service("info@resonance.test").geocode(null))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.ADDRESS_NOT_FOUND));
        server.verify();
    }

    @Test
    void geocode_whenNominatimAnswersWith500_throwsGeocodingUnavailable() {
        server.expect(requestTo(URL + "/search?q=Roma&format=jsonv2&limit=1")).andRespond(withServerError());

        assertUnavailable(() -> service("info@resonance.test").geocode("Roma"));
    }

    @Test
    void geocode_whenNominatimAnswersWith429_throwsGeocodingUnavailable() {
        server.expect(requestTo(URL + "/search?q=Roma&format=jsonv2&limit=1"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        assertUnavailable(() -> service("info@resonance.test").geocode("Roma"));
    }

    @Test
    void geocode_whenTheNetworkFails_throwsGeocodingUnavailable() {
        // Copre anche i timeout di connessione e di lettura: per il client sono errori di I/O.
        server.expect(requestTo(URL + "/search?q=Roma&format=jsonv2&limit=1"))
                .andRespond(request -> {
                    throw new IOException("timeout");
                });

        assertUnavailable(() -> service("info@resonance.test").geocode("Roma"));
    }

    @Test
    void geocode_whenTheBodyIsNotTheExpectedJson_throwsGeocodingUnavailable() {
        server.expect(requestTo(URL + "/search?q=Roma&format=jsonv2&limit=1"))
                .andRespond(withSuccess("<html>manutenzione</html>", MediaType.TEXT_HTML));

        assertUnavailable(() -> service("info@resonance.test").geocode("Roma"));
    }

    @Test
    void geocode_whenTheCoordinatesAreNotNumbers_throwsGeocodingUnavailable() {
        server.expect(requestTo(URL + "/search?q=Roma&format=jsonv2&limit=1"))
                .andRespond(withSuccess("[{\"lat\":\"abc\",\"lon\":\"11.2\"}]", MediaType.APPLICATION_JSON));

        assertUnavailable(() -> service("info@resonance.test").geocode("Roma"));
    }

    @Test
    void geocode_twoConsecutiveCalls_waitUntilOneSecondHasPassed() {
        expectTwoSuccessfulCalls();
        NominatimGeocodingService service = service("info@resonance.test");

        service.geocode("Roma");
        service.geocode("Roma");

        // Il primo non aspetta; il secondo parte nello stesso istante e deve attendere l'intero secondo.
        assertThat(pauses).containsExactly(Duration.ofSeconds(1));
        server.verify();
    }

    @Test
    void geocode_waitsOnlyForTheRemainingTimeOfTheSecond() {
        expectTwoSuccessfulCalls();
        NominatimGeocodingService service = service("info@resonance.test");

        service.geocode("Roma");
        clock.advance(Duration.ofMillis(400));
        service.geocode("Roma");

        assertThat(pauses).containsExactly(Duration.ofMillis(600));
    }

    @Test
    void geocode_afterMoreThanOneSecond_doesNotWait() {
        expectTwoSuccessfulCalls();
        NominatimGeocodingService service = service("info@resonance.test");

        service.geocode("Roma");
        clock.advance(Duration.ofMillis(1001));
        service.geocode("Roma");

        assertThat(pauses).isEmpty();
    }

    @Test
    void geocode_whenTheWaitIsInterrupted_throwsGeocodingUnavailableAndKeepsTheInterruptFlag() {
        // Una sola richiesta attesa: la seconda chiamata si interrompe nell'attesa, prima di partire.
        server.expect(requestTo(URL + "/search?q=Roma&format=jsonv2&limit=1"))
                .andRespond(withSuccess(FOUND, MediaType.APPLICATION_JSON));
        NominatimGeocodingService service = new NominatimGeocodingService(builder, URL, "", clock, MAX_WAIT, pause -> {
            throw new InterruptedException();
        });

        service.geocode("Roma");
        assertUnavailable(() -> service.geocode("Roma"));

        assertThat(Thread.currentThread().isInterrupted()).isTrue();
    }

    @Test
    void geocode_whenTheTurnStaysBusyLongerThanTheMaxWait_throwsUnavailableWithoutCallingNominatim()
            throws Exception {
        // Il primo turno (nel thread "occupante") resta fermo nella pausa e tiene il lock; il secondo non aspetta
        // oltre l'attesa massima e non arriva a Nominatim (decisione 76, S3).
        expectTwoSuccessfulCalls();
        CountDownLatch holderInside = new CountDownLatch(1);
        CountDownLatch releaseHolder = new CountDownLatch(1);
        NominatimGeocodingService service = new NominatimGeocodingService(builder, URL, "", clock, MAX_WAIT, pause -> {
            holderInside.countDown();
            releaseHolder.await(10, TimeUnit.SECONDS);
        });
        service.geocode("Roma");
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            // Seconda chiamata a orologio fermo: deve attendere un secondo, quindi entra nella pausa bloccata.
            Future<GeoPoint> holder = pool.submit(() -> service.geocode("Roma"));
            assertThat(holderInside.await(10, TimeUnit.SECONDS)).isTrue();

            long startedAt = System.nanoTime();
            assertUnavailable(() -> service.geocode("Roma"));
            Duration waited = Duration.ofNanos(System.nanoTime() - startedAt);

            assertThat(waited).isLessThan(Duration.ofSeconds(5));
            releaseHolder.countDown();
            assertThat(holder.get(10, TimeUnit.SECONDS)).isNotNull();
        } finally {
            releaseHolder.countDown();
            pool.shutdownNow();
        }
        // Due sole richieste a Nominatim: quella del primo turno e quella del thread occupante.
        server.verify();
    }

    private void expectTwoSuccessfulCalls() {
        server.expect(requestTo(URL + "/search?q=Roma&format=jsonv2&limit=1"))
                .andRespond(withSuccess(FOUND, MediaType.APPLICATION_JSON));
        server.expect(requestTo(URL + "/search?q=Roma&format=jsonv2&limit=1"))
                .andRespond(withSuccess(FOUND, MediaType.APPLICATION_JSON));
    }

    private static void assertUnavailable(Runnable call) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(AppException.class,
                e -> assertThat(e.getCode()).isEqualTo(ErrorCode.GEOCODING_UNAVAILABLE));
    }

    // La pausa finta registra l'attesa richiesta senza dormire.
    private NominatimGeocodingService service(String contact) {
        return new NominatimGeocodingService(builder, URL, contact, clock, MAX_WAIT, pauses::add);
    }
}

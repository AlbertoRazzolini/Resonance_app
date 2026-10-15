package it.epicode.resonance.event;

import it.epicode.resonance.geo.Haversine;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Ricerca nelle vicinanze dei concerti (progettazione, sezione 10.2): ordine per distanza, raggio, esclusione
 * di passati e nascosti, distanza della query SQL uguale a quella di {@link Haversine}, paginazione e
 * parametri non validi. Il centro delle ricerche e' Firenze.
 */
class NearbySqlTest extends IntegrationTest {

    private static final double FLORENCE_LAT = 43.7696;
    private static final double FLORENCE_LNG = 11.2558;
    // Pistoia: circa 30 km da Firenze. Roma: circa 232 km.
    private static final double PISTOIA_LAT = 43.9330;
    private static final double PISTOIA_LNG = 10.9170;
    private static final double ROME_LAT = 41.8959;
    private static final double ROME_LNG = 12.4823;

    @Autowired
    private OfficialConcertRepository concerts;

    @Autowired
    private UserRepository users;

    @Autowired
    private JdbcTemplate jdbc;

    private User host;

    @BeforeEach
    void createHost() {
        host = new User("host@example.com", "hash-di-prova", "Host");
        host.setEmailVerified(true);
        users.save(host);
    }

    @Test
    void nearby_ordersByDistanceAndExcludesFarConcerts() throws Exception {
        concert("Pistoia", PISTOIA_LAT, PISTOIA_LNG, days(10));
        concert("Roma", ROME_LAT, ROME_LNG, days(10));
        concert("Firenze", FLORENCE_LAT, FLORENCE_LNG, days(10));

        // Roma dista circa 232 km da Firenze: fuori da un raggio di 200 km, dentro da un centro piu' a sud.
        nearby(FLORENCE_LAT, FLORENCE_LNG, 100)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].title", contains("Firenze", "Pistoia")))
                .andExpect(jsonPath("$.totalElements").value(2));
        nearby(FLORENCE_LAT, FLORENCE_LNG, 200)
                .andExpect(jsonPath("$.content[*].title", contains("Firenze", "Pistoia")));
        // Da (42.8, 12.0): Roma a circa 107 km, Firenze a 124, Pistoia a 153.
        nearby(42.8, 12.0, 200)
                .andExpect(jsonPath("$.content[*].title", contains("Roma", "Firenze", "Pistoia")))
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    void nearby_radiusAboveMaximum_returns400() throws Exception {
        nearby(FLORENCE_LAT, FLORENCE_LNG, 240)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.radiusKm").exists());
    }

    @Test
    void nearby_isPublic_andReturnsDistanceAndAuthor() throws Exception {
        concert("Pistoia", PISTOIA_LAT, PISTOIA_LNG, days(10));

        // Nessun token: la ricerca e' pubblica.
        nearby(FLORENCE_LAT, FLORENCE_LNG, 50)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].host.displayName").value("Host"))
                .andExpect(jsonPath("$.content[0].host.email").doesNotExist())
                .andExpect(jsonPath("$.content[0].distanceKm").isNumber());
    }

    @Test
    void nearby_excludesPastConcerts() throws Exception {
        concert("Passato", FLORENCE_LAT, FLORENCE_LNG, Instant.now().minus(Duration.ofDays(1)));
        concert("Futuro", FLORENCE_LAT, FLORENCE_LNG, days(1));

        nearby(FLORENCE_LAT, FLORENCE_LNG, 10)
                .andExpect(jsonPath("$.content[*].title", contains("Futuro")))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void nearby_usesTheTestClockForThePast() throws Exception {
        concert("Fra due giorni", FLORENCE_LAT, FLORENCE_LNG, days(2));

        nearby(FLORENCE_LAT, FLORENCE_LNG, 10).andExpect(jsonPath("$.content", hasSize(1)));

        // Il "passato" e' deciso dal Clock dell'applicazione, non dall'orologio del database.
        clock.advance(Duration.ofDays(3));
        nearby(FLORENCE_LAT, FLORENCE_LNG, 10).andExpect(jsonPath("$.content", hasSize(0)));
    }

    @Test
    void nearby_excludesHiddenConcerts() throws Exception {
        concert("Visibile", FLORENCE_LAT, FLORENCE_LNG, days(1));
        OfficialConcert hidden = concert("Nascosto", FLORENCE_LAT, FLORENCE_LNG, days(1));
        hidden.getModeration().hide(host.getId(), "motivo", Instant.now());
        concerts.save(hidden);

        nearby(FLORENCE_LAT, FLORENCE_LNG, 10)
                .andExpect(jsonPath("$.content[*].title", contains("Visibile")))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void nearby_sameDistance_ordersByEventDate() throws Exception {
        concert("Dopo", FLORENCE_LAT, FLORENCE_LNG, days(20));
        concert("Prima", FLORENCE_LAT, FLORENCE_LNG, days(5));
        concert("In mezzo", FLORENCE_LAT, FLORENCE_LNG, days(10));

        nearby(FLORENCE_LAT, FLORENCE_LNG, 10)
                .andExpect(jsonPath("$.content[*].title", contains("Prima", "In mezzo", "Dopo")));
    }

    @Test
    void nearby_sqlDistanceMatchesHaversine() throws Exception {
        concert("Pistoia", PISTOIA_LAT, PISTOIA_LNG, days(10));
        concert("Roma", ROME_LAT, ROME_LNG, days(10));

        double pistoia = Haversine.km(FLORENCE_LAT, FLORENCE_LNG, PISTOIA_LAT, PISTOIA_LNG);
        double rome = Haversine.km(FLORENCE_LAT, FLORENCE_LNG, ROME_LAT, ROME_LNG);

        // La query SQL e Haversine.km usano la stessa formula e lo stesso raggio terrestre: stessa distanza.
        nearby(FLORENCE_LAT, FLORENCE_LNG, 200)
                .andExpect(jsonPath("$.content[0].distanceKm").value(closeTo(pistoia, 0.01)));
        nearby(41.9, 12.5, 50)
                .andExpect(jsonPath("$.content[0].distanceKm")
                        .value(closeTo(Haversine.km(41.9, 12.5, ROME_LAT, ROME_LNG), 0.01)));
        assertThat(rome).isBetween(230.0, 235.0);
    }

    @Test
    void nearby_paginates_andCountsAllMatches() throws Exception {
        concert("Firenze", FLORENCE_LAT, FLORENCE_LNG, days(10));
        concert("Pistoia", PISTOIA_LAT, PISTOIA_LNG, days(10));

        nearby(FLORENCE_LAT, FLORENCE_LNG, 100, "&page=0&size=1")
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].title").value("Firenze"))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));
        nearby(FLORENCE_LAT, FLORENCE_LNG, 100, "&page=1&size=1")
                .andExpect(jsonPath("$.content[0].title").value("Pistoia"))
                .andExpect(jsonPath("$.totalElements").value(2));
        nearby(FLORENCE_LAT, FLORENCE_LNG, 100, "&page=5&size=1")
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void nearby_nearPole_doesNotFail() throws Exception {
        concert("Firenze", FLORENCE_LAT, FLORENCE_LNG, days(10));

        // Vicino ai poli cos(lat) tende a zero: la bounding box non deve dare Infinity o NaN (Review Focus 4).
        nearby(89.99, 0, 50)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(0));
        nearby(-89.99, 179.9, 200).andExpect(status().isOk());
    }

    @Test
    void nearby_withoutConcerts_returnsEmptyPage() throws Exception {
        nearby(FLORENCE_LAT, FLORENCE_LNG, 10)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.totalPages").value(0));
    }

    @Test
    void nearby_withoutLat_returns400() throws Exception {
        mockMvc.perform(get("/api/official-concerts/nearby?lng=11.2&radiusKm=10"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void nearby_withoutRadius_returns400() throws Exception {
        mockMvc.perform(get("/api/official-concerts/nearby?lat=43.7&lng=11.2"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void nearby_withOutOfRangeValues_returns400WithFields() throws Exception {
        mockMvc.perform(get("/api/official-concerts/nearby?lat=91&lng=181&radiusKm=0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.lat").exists())
                .andExpect(jsonPath("$.fields.lng").exists())
                .andExpect(jsonPath("$.fields.radiusKm").exists());
    }

    @Test
    void nearby_withNonNumericValue_returns400() throws Exception {
        mockMvc.perform(get("/api/official-concerts/nearby?lat=abc&lng=11.2&radiusKm=10"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mockMvc.perform(get("/api/official-concerts/nearby?lat=NaN&lng=11.2&radiusKm=10"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.lat").exists());
    }

    @Test
    void nearby_withPaginationOutOfRange_returns400() throws Exception {
        for (String params : new String[]{"&page=-1", "&size=0", "&size=1000"}) {
            mockMvc.perform(get("/api/official-concerts/nearby?lat=43.7&lng=11.2&radiusKm=10" + params))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        }
    }

    @Test
    void nearby_doesNotReturnDistanceOnDetail() throws Exception {
        OfficialConcert concert = concert("Firenze", FLORENCE_LAT, FLORENCE_LNG, days(10));

        mockMvc.perform(get("/api/official-concerts/{id}", concert.getId()))
                .andExpect(jsonPath("$.distanceKm").value(nullValue()));
    }

    // ---- supporto ----

    private ResultActions nearby(double lat, double lng, double radiusKm) throws Exception {
        return nearby(lat, lng, radiusKm, "");
    }

    private ResultActions nearby(double lat, double lng, double radiusKm, String extra) throws Exception {
        return mockMvc.perform(get("/api/official-concerts/nearby?lat=" + lat + "&lng=" + lng
                + "&radiusKm=" + radiusKm + extra));
    }

    private Instant days(int days) {
        return Instant.now().plus(Duration.ofDays(days));
    }

    private OfficialConcert concert(String title, double lat, double lng, Instant date) {
        return concerts.save(new OfficialConcert(host, title, "Teatro Test", "Indirizzo di prova", lat, lng, date));
    }
}

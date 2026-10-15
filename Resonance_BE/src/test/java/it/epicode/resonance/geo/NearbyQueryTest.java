package it.epicode.resonance.geo;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.offset;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Validazione dei parametri di una ricerca nelle vicinanze e calcolo della bounding box di prefiltro
 * (progettazione, sezione 10.2).
 */
class NearbyQueryTest {

    @Test
    void boundingBox_aroundFlorence_coversTheRadiusWithoutExceedingIt() {
        NearbyQuery query = new NearbyQuery(43.7696, 11.2558, 50);

        // 50 km valgono circa 0,45 gradi di latitudine e 0,62 di longitudine a 43,8 gradi nord.
        assertThat(query.minLat()).isCloseTo(43.7696 - 0.4503, offset(0.001));
        assertThat(query.maxLat()).isCloseTo(43.7696 + 0.4503, offset(0.001));
        assertThat(query.minLng()).isCloseTo(11.2558 - 0.6243, offset(0.001));
        assertThat(query.maxLng()).isCloseTo(11.2558 + 0.6243, offset(0.001));
    }

    @Test
    void boundingBox_containsEveryPointWithinTheRadius() {
        NearbyQuery query = new NearbyQuery(43.7696, 11.2558, 100);

        // Bologna e' a ~97 km da Firenze: sta dentro il raggio, quindi anche dentro la bounding box.
        double bolognaLat = 44.4949;
        double bolognaLng = 11.3426;
        assertThat(Haversine.km(query.lat(), query.lng(), bolognaLat, bolognaLng)).isLessThan(100);
        assertThat(bolognaLat).isBetween(query.minLat(), query.maxLat());
        assertThat(bolognaLng).isBetween(query.minLng(), query.maxLng());
    }

    @Test
    void boundingBox_nearThePole_hasNoInfinityOrNaN() {
        NearbyQuery query = new NearbyQuery(89.99, 10.0, 100);

        assertThat(query.minLat()).isFinite();
        assertThat(query.maxLat()).isFinite().isLessThanOrEqualTo(90.0);
        assertThat(query.minLng()).isFinite().isGreaterThanOrEqualTo(-180.0);
        assertThat(query.maxLng()).isFinite().isLessThanOrEqualTo(180.0);
    }

    @Test
    void boundingBox_atTheExactPole_hasNoInfinityOrNaN() {
        NearbyQuery query = new NearbyQuery(90.0, 0.0, 200);

        assertThat(query.minLng()).isFinite();
        assertThat(query.maxLng()).isFinite();
    }

    @Test
    void constructor_acceptsTheLimitValues() {
        new NearbyQuery(-90, -180, 0.1);
        new NearbyQuery(90, 180, 200);
    }

    @Test
    void constructor_rejectsLatitudeOutOfRange() {
        assertThatThrownBy(() -> new NearbyQuery(90.01, 0, 10))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getCode()).isEqualTo(ErrorCode.VALIDATION_ERROR);
                    assertThat(e.getFields()).containsKey("lat");
                });
    }

    @Test
    void constructor_rejectsLongitudeOutOfRange() {
        assertThatThrownBy(() -> new NearbyQuery(0, -180.01, 10))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getFields()).containsKey("lng"));
    }

    @Test
    void constructor_rejectsRadiusOutsideTheAllowedRange() {
        assertThatThrownBy(() -> new NearbyQuery(0, 0, 0.09))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getFields()).containsKey("radiusKm"));
        assertThatThrownBy(() -> new NearbyQuery(0, 0, 200.01))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getFields()).containsKey("radiusKm"));
    }

    @Test
    void constructor_rejectsNaNAndReportsEveryInvalidField() {
        assertThatThrownBy(() -> new NearbyQuery(Double.NaN, 200, 0))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getFields()).containsOnlyKeys("lat", "lng", "radiusKm"));
    }
}

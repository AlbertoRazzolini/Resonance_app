package it.epicode.resonance.geo;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.offset;

/**
 * Distanze note calcolate da Haversine, l'oracolo con cui si controllerà la query SQL
 * (progettazione, sezione 10.3).
 */
class HaversineTest {

    @Test
    void km_betweenFlorenceAndRome_isAbout232() {
        double km = Haversine.km(43.7696, 11.2558, 41.9028, 12.4964);

        // Con i centri citta' e il raggio medio 6371 km la formula da' 230,9 km: ~232 con tolleranza 2 km.
        assertThat(km).isCloseTo(232.0, offset(2.0));
    }

    @Test
    void km_betweenTheSamePoint_isZero() {
        assertThat(Haversine.km(43.7696, 11.2558, 43.7696, 11.2558)).isZero();
    }

    @Test
    void km_isSymmetric() {
        double there = Haversine.km(43.7696, 11.2558, 41.9028, 12.4964);
        double back = Haversine.km(41.9028, 12.4964, 43.7696, 11.2558);

        assertThat(there).isEqualTo(back);
    }

    @Test
    void km_betweenThePoles_isHalfTheMeridian() {
        // Mezzo meridiano: pi * raggio medio della Terra (6371 km).
        double km = Haversine.km(90, 0, -90, 0);

        assertThat(km).isCloseTo(Math.PI * 6371.0, offset(0.001));
    }

    @Test
    void km_nearThePole_isFiniteAndSmall() {
        // Vicino al polo i meridiani convergono: due punti lontani in longitudine restano vicini.
        double km = Haversine.km(89.99, 0, 89.99, 180);

        assertThat(km).isFinite().isLessThan(3.0);
    }
}

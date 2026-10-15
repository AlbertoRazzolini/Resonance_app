package it.epicode.resonance.support;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.geo.GeoPoint;
import it.epicode.resonance.geo.GeocodingService;
import it.epicode.resonance.geo.NominatimGeocodingService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Lo stub di geocodifica dei test di integrazione: sostituisce Nominatim (progettazione, sezione 10.1) e
 * risponde con coordinate fisse, "indirizzo non trovato" o "servizio non disponibile" secondo l'indirizzo.
 */
class StubGeocodingConfigTest extends IntegrationTest {

    @Autowired
    private GeocodingService geocodingService;

    @Test
    void geocodingService_isTheStubAndNotNominatim() {
        assertThat(geocodingService).isNotInstanceOf(NominatimGeocodingService.class);
    }

    @Test
    void geocode_knownAddress_returnsFixedCoordinates() {
        GeoPoint florence = geocodingService.geocode(StubGeocodingConfig.FLORENCE_ADDRESS);

        assertThat(florence).isEqualTo(StubGeocodingConfig.FLORENCE);
        assertThat(geocodingService.geocode("  piazza della signoria, firenze ")).isEqualTo(florence);
    }

    @Test
    void geocode_notFoundAddress_throwsAddressNotFound() {
        assertThatThrownBy(() -> geocodingService.geocode("NON TROVATO"))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getCode()).isEqualTo(ErrorCode.ADDRESS_NOT_FOUND);
                    assertThat(e.getFields()).containsKey("address");
                });
    }

    @Test
    void geocode_downAddress_throwsGeocodingUnavailable() {
        assertThatThrownBy(() -> geocodingService.geocode("DOWN"))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.GEOCODING_UNAVAILABLE));
    }

    @Test
    void geocode_unknownAddress_isNotFound() {
        // Un indirizzo non previsto non deve diventare coordinate inventate: i test lo vedrebbero subito.
        assertThatThrownBy(() -> geocodingService.geocode("Via Inventata 1, Atlantide"))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.ADDRESS_NOT_FOUND));
    }
}

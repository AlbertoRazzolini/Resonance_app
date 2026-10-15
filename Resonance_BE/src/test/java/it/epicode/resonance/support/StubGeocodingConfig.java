package it.epicode.resonance.support;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.geo.GeoPoint;
import it.epicode.resonance.geo.GeocodingService;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.util.Locale;
import java.util.Map;

/**
 * Sostituisce Nominatim nei test di integrazione (progettazione, sezione 10.1): nessuna chiamata di rete,
 * coordinate fisse per pochi indirizzi noti, "NON TROVATO" per l'indirizzo inesistente e "DOWN" per il
 * servizio fuori uso. Un indirizzo non previsto e' "non trovato", cosi' un test non ottiene coordinate
 * inventate senza accorgersene.
 */
@TestConfiguration
public class StubGeocodingConfig {

    public static final String FLORENCE_ADDRESS = "Piazza della Signoria, Firenze";
    public static final String ROME_ADDRESS = "Piazza Venezia, Roma";
    public static final String MILAN_ADDRESS = "Piazza del Duomo, Milano";
    public static final String NOT_FOUND_ADDRESS = "NON TROVATO";
    public static final String DOWN_ADDRESS = "DOWN";

    public static final GeoPoint FLORENCE = new GeoPoint(43.7696, 11.2558);
    public static final GeoPoint ROME = new GeoPoint(41.8959, 12.4823);
    public static final GeoPoint MILAN = new GeoPoint(45.4641, 9.1919);

    private static final Map<String, GeoPoint> KNOWN = Map.of(
            normalize(FLORENCE_ADDRESS), FLORENCE,
            normalize(ROME_ADDRESS), ROME,
            normalize(MILAN_ADDRESS), MILAN);

    @Bean
    @Primary
    public GeocodingService stubGeocodingService() {
        return StubGeocodingConfig::geocode;
    }

    private static GeoPoint geocode(String address) {
        String key = normalize(address);
        if (key.equals(normalize(DOWN_ADDRESS))) {
            throw new AppException(ErrorCode.GEOCODING_UNAVAILABLE, "Servizio di geocodifica non disponibile");
        }
        GeoPoint point = KNOWN.get(key);
        if (point == null) {
            throw new AppException(ErrorCode.ADDRESS_NOT_FOUND, "Indirizzo non trovato",
                    Map.of("address", "Indirizzo non trovato"));
        }
        return point;
    }

    private static String normalize(String address) {
        return address == null ? "" : address.strip().toLowerCase(Locale.ROOT);
    }
}

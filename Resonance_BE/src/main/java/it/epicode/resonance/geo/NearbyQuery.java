package it.epicode.resonance.geo;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Parametri di una ricerca nelle vicinanze (progettazione, sezione 10.2): centro e raggio, con la bounding
 * box usata come prefiltro sugli indici (latitudine, longitudine) prima del calcolo esatto della distanza.
 * Il costruttore rifiuta valori fuori range con VALIDATION_ERROR e l'elenco dei campi non validi.
 */
public record NearbyQuery(double lat, double lng, double radiusKm) {

    private static final double MIN_RADIUS_KM = 0.1;
    private static final double MAX_RADIUS_KM = 200;
    private static final double KM_PER_DEGREE = 111.045;
    // Vicino ai poli cos(lat) tende a 0 e il delta di longitudine esploderebbe: lo si limita (e la box
    // finale si taglia a +-180), tanto il filtro esatto e' la distanza di Haversine.
    private static final double MIN_COS_LAT = 0.01;

    public NearbyQuery {
        Map<String, String> fields = new LinkedHashMap<>();
        // Le negazioni fanno rifiutare anche NaN, per cui ogni confronto e' falso.
        if (!(lat >= -90 && lat <= 90)) {
            fields.put("lat", "deve essere compresa fra -90 e 90");
        }
        if (!(lng >= -180 && lng <= 180)) {
            fields.put("lng", "deve essere compresa fra -180 e 180");
        }
        if (!(radiusKm >= MIN_RADIUS_KM && radiusKm <= MAX_RADIUS_KM)) {
            fields.put("radiusKm", "deve essere compreso fra 0,1 e 200 km");
        }
        if (!fields.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Parametri di ricerca non validi", fields);
        }
    }

    public double minLat() {
        return Math.max(-90.0, lat - latDelta());
    }

    public double maxLat() {
        return Math.min(90.0, lat + latDelta());
    }

    public double minLng() {
        return Math.max(-180.0, lng - lngDelta());
    }

    public double maxLng() {
        return Math.min(180.0, lng + lngDelta());
    }

    private double latDelta() {
        return radiusKm / KM_PER_DEGREE;
    }

    private double lngDelta() {
        double cosLat = Math.max(Math.cos(Math.toRadians(lat)), MIN_COS_LAT);
        return radiusKm / (KM_PER_DEGREE * cosLat);
    }
}

package it.epicode.resonance.geo;

/**
 * Trasforma un indirizzo in coordinate (progettazione, sezione 10.1). Va chiamato fuori dalle transazioni
 * del database: la risposta di un servizio esterno non deve tenere occupata una connessione.
 */
public interface GeocodingService {

    /**
     * Coordinate del primo risultato per l'indirizzo. Lancia ADDRESS_NOT_FOUND (400, fields.address) se non
     * esiste, GEOCODING_UNAVAILABLE (502) se il servizio non risponde.
     */
    GeoPoint geocode(String address);
}

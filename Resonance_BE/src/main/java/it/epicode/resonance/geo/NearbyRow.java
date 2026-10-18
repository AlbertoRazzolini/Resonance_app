package it.epicode.resonance.geo;

import java.util.UUID;

/**
 * Riga del risultato di una ricerca nelle vicinanze (concerti, indie event, feed): id dell'elemento e distanza
 * dal centro, in km. Contiene anche la formula della distanza, uguale per le tre query (decisione 57).
 */
public interface NearbyRow {

    /**
     * Distanza di Haversine in km fra il centro (:lat, :lng) e la riga con alias {@code e}, con raggio terrestre
     * 6371 km: la stessa formula di {@code geo.Haversine}, che nei test fa da oracolo. {@code least(1.0, ...)}
     * protegge asin() dagli errori di arrotondamento che porterebbero l'argomento appena sopra 1. Resta una
     * costante perche' il testo di una {@code @Query} deve essere noto alla compilazione.
     */
    String DISTANCE_KM = """
            2 * 6371.0 * asin(least(1.0, sqrt(
                power(sin(radians(e.latitude - cast(:lat as double precision)) / 2), 2)
                + cos(radians(cast(:lat as double precision))) * cos(radians(e.latitude))
                  * power(sin(radians(e.longitude - cast(:lng as double precision)) / 2), 2))))""";

    UUID getId();

    double getDistanceKm();
}

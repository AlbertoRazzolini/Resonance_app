package it.epicode.resonance.event;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Accesso ai concerti ufficiali, compresa la ricerca nelle vicinanze (progettazione, sezione 10.2).
 */
public interface OfficialConcertRepository extends JpaRepository<OfficialConcert, UUID> {

    /**
     * Distanza di Haversine in km fra il centro (:lat, :lng) e il concerto, con raggio terrestre 6371 km: la
     * stessa formula di {@code geo.Haversine}, che nei test fa da oracolo. {@code least(1.0, ...)} protegge
     * asin() dagli errori di arrotondamento che porterebbero l'argomento appena sopra 1.
     */
    String DISTANCE_KM = """
            2 * 6371.0 * asin(least(1.0, sqrt(
                power(sin(radians(c.latitude - cast(:lat as double precision)) / 2), 2)
                + cos(radians(cast(:lat as double precision))) * cos(radians(c.latitude))
                  * power(sin(radians(c.longitude - cast(:lng as double precision)) / 2), 2))))""";

    /**
     * Concerti visibili e futuri dentro la bounding box, con la distanza calcolata: la box usa gli indici su
     * (latitude, longitude), il filtro esatto sul raggio sta nella query che la racchiude.
     */
    String CANDIDATES = """
            select c.id as id, c.event_date as event_date, """ + DISTANCE_KM + """
             as distance_km
            from official_concerts c
            where c.hidden_at is null and c.event_date >= :now
              and c.latitude between :minLat and :maxLat
              and c.longitude between :minLng and :maxLng""";

    /**
     * Cerca per id caricando subito l'autore, che serve a ogni risposta. Non filtra i nascosti: lo fa il service.
     */
    @EntityGraph(attributePaths = "host")
    Optional<OfficialConcert> findWithHostById(UUID id);

    /**
     * Concerti nascosti (da un admin o dal proprietario) con l'autore gia' caricato, per l'elenco della moderazione.
     */
    @EntityGraph(attributePaths = "host")
    Page<OfficialConcert> findByModerationHiddenAtIsNotNull(Pageable pageable);

    /**
     * Concerti con i loro autori, per comporre la pagina di una ricerca nelle vicinanze.
     */
    @EntityGraph(attributePaths = "host")
    List<OfficialConcert> findByIdIn(Collection<UUID> ids);

    /**
     * Una pagina di id con la distanza, dal piu' vicino; a parita' di distanza vince la data, poi l'id
     * (ordinamento stabile, sezione 10.2). I concerti veri si caricano a parte con {@link #findByIdIn}.
     */
    @Query(nativeQuery = true, value = "select t.id as id, t.distance_km as \"distanceKm\" from ("
            + CANDIDATES + ") t where t.distance_km <= :radiusKm "
            + "order by t.distance_km, t.event_date, t.id limit :limit offset :offset")
    List<NearbyRow> findNearby(double lat, double lng, double radiusKm, double minLat, double maxLat,
                               double minLng, double maxLng, Instant now, int limit, long offset);

    /**
     * Quanti concerti rispondono alla ricerca, con gli stessi filtri di {@link #findNearby}.
     */
    @Query(nativeQuery = true, value = "select count(*) from (" + CANDIDATES + ") t where t.distance_km <= :radiusKm")
    long countNearby(double lat, double lng, double radiusKm, double minLat, double maxLat, double minLng,
                     double maxLng, Instant now);

    /**
     * Riga del risultato di {@link #findNearby}: id del concerto e distanza dal centro, in km.
     */
    interface NearbyRow {

        UUID getId();

        double getDistanceKm();
    }
}

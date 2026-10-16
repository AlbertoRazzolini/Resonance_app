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
 * Accesso agli indie event.
 */
public interface IndieEventRepository extends JpaRepository<IndieEvent, UUID> {

    /**
     * Eventi pubblicati, visibili e futuri dentro la bounding box, con la distanza calcolata (stessa formula dei
     * concerti, {@link OfficialConcertRepository#DISTANCE_KM}, con alias {@code c}). Le bozze non compaiono
     * mai nella ricerca, nemmeno per il proprietario (progettazione, sezione 6.6).
     */
    String CANDIDATES = """
            select c.id as id, c.event_date as event_date, """ + OfficialConcertRepository.DISTANCE_KM + """
             as distance_km
            from indie_events c
            where c.status = 'PUBLISHED' and c.hidden_at is null and c.event_date >= :now
              and c.latitude between :minLat and :maxLat
              and c.longitude between :minLng and :maxLng""";

    /**
     * Cerca per id caricando subito l'autore, che serve a ogni risposta. Non filtra nascosti e bozze: lo fa il
     * service.
     */
    @EntityGraph(attributePaths = "musician")
    Optional<IndieEvent> findWithMusicianById(UUID id);

    /**
     * Eventi nascosti (da un admin o dal proprietario) con l'autore gia' caricato, per l'elenco della moderazione.
     */
    @EntityGraph(attributePaths = "musician")
    Page<IndieEvent> findByModerationHiddenAtIsNotNull(Pageable pageable);

    /**
     * Eventi non nascosti di un musicista, bozze comprese, con l'autore gia' caricato (elenco "mine").
     */
    @EntityGraph(attributePaths = "musician")
    Page<IndieEvent> findByMusicianIdAndModerationHiddenAtIsNull(UUID musicianId, Pageable pageable);

    /**
     * Eventi con i loro autori, per comporre la pagina di una ricerca nelle vicinanze.
     */
    @EntityGraph(attributePaths = "musician")
    List<IndieEvent> findByIdIn(Collection<UUID> ids);

    /**
     * Una pagina di id con la distanza, dal piu' vicino; a parita' di distanza vince la data, poi l'id
     * (ordinamento stabile, sezione 10.2). Gli eventi veri si caricano a parte con {@link #findByIdIn}.
     */
    @Query(nativeQuery = true, value = "select t.id as id, t.distance_km as \"distanceKm\" from ("
            + CANDIDATES + ") t where t.distance_km <= :radiusKm "
            + "order by t.distance_km, t.event_date, t.id limit :limit offset :offset")
    List<NearbyRow> findNearby(double lat, double lng, double radiusKm, double minLat, double maxLat,
                               double minLng, double maxLng, Instant now, int limit, long offset);

    /**
     * Quanti eventi rispondono alla ricerca, con gli stessi filtri di {@link #findNearby}.
     */
    @Query(nativeQuery = true, value = "select count(*) from (" + CANDIDATES + ") t where t.distance_km <= :radiusKm")
    long countNearby(double lat, double lng, double radiusKm, double minLat, double maxLat, double minLng,
                     double maxLng, Instant now);

    /**
     * Riga del risultato di {@link #findNearby}: id dell'evento e distanza dal centro, in km.
     */
    interface NearbyRow {

        UUID getId();

        double getDistanceKm();
    }
}

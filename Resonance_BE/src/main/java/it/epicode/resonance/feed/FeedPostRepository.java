package it.epicode.resonance.feed;

import it.epicode.resonance.geo.NearbyRow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Accesso ai post del feed, compreso il filtro per raggio (progettazione, sezione 10.2).
 */
public interface FeedPostRepository extends JpaRepository<FeedPost, UUID> {

    /**
     * Post visibili con coordinate dentro la bounding box, con la distanza calcolata: la box usa l'indice su
     * (latitude, longitude), il filtro esatto sul raggio sta nella query che la racchiude. I post senza
     * coordinate non entrano mai nel confronto.
     */
    String CANDIDATES = """
            select e.id as id, e.created_at as created_at, """ + NearbyRow.DISTANCE_KM + """
             as distance_km
            from feed_posts e
            where e.hidden_at is null
              and e.latitude between :minLat and :maxLat
              and e.longitude between :minLng and :maxLng""";

    /**
     * Cerca per id caricando subito l'autore, che serve a ogni risposta. Non filtra i nascosti: lo fa il service.
     */
    @EntityGraph(attributePaths = "author")
    Optional<FeedPost> findWithAuthorById(UUID id);

    /**
     * Post nascosti (da un admin o dal proprietario) con l'autore gia' caricato, per l'elenco della moderazione.
     */
    @EntityGraph(attributePaths = "author")
    Page<FeedPost> findByModerationHiddenAtIsNotNull(Pageable pageable);

    /**
     * Post non nascosti con l'autore gia' caricato (lista senza filtro geografico).
     */
    @EntityGraph(attributePaths = "author")
    Page<FeedPost> findByModerationHiddenAtIsNull(Pageable pageable);

    /**
     * Post non nascosti di un autore con l'autore gia' caricato (elenco "mine").
     */
    @EntityGraph(attributePaths = "author")
    Page<FeedPost> findByAuthorIdAndModerationHiddenAtIsNull(UUID authorId, Pageable pageable);

    /**
     * Post con i loro autori, per comporre la pagina di una lista con il filtro per raggio.
     */
    @EntityGraph(attributePaths = "author")
    List<FeedPost> findByIdIn(Collection<UUID> ids);

    /**
     * Una pagina di id con la distanza, dal piu' recente; a parita' di data vince l'id (ordinamento stabile,
     * sezione 10.2). I post veri si caricano a parte con {@link #findByIdIn}.
     */
    @Query(nativeQuery = true, value = "select t.id as id, t.distance_km as \"distanceKm\" from ("
            + CANDIDATES + ") t where t.distance_km <= :radiusKm "
            + "order by t.created_at desc, t.id desc limit :limit offset :offset")
    List<NearbyRow> findNearby(double lat, double lng, double radiusKm, double minLat, double maxLat,
                               double minLng, double maxLng, int limit, long offset);

    /**
     * Quanti post rispondono al filtro, con gli stessi criteri di {@link #findNearby}.
     */
    @Query(nativeQuery = true, value = "select count(*) from (" + CANDIDATES + ") t where t.distance_km <= :radiusKm")
    long countNearby(double lat, double lng, double radiusKm, double minLat, double maxLat, double minLng,
                     double maxLng);

    /**
     * Vero se il post esiste e non e' nascosto (like e unlike su un post nascosto sono un 404).
     */
    boolean existsByIdAndModerationHiddenAtIsNull(UUID id);

    /**
     * Aumenta di uno il contatore dei like con un UPDATE del database, non "leggi, somma, salva" in Java: con like
     * simultanei nessun aggiornamento va perso (progettazione, sezione 3.4).
     */
    @Modifying
    @Query(nativeQuery = true, value = "update feed_posts set likes_count = likes_count + 1 where id = :id")
    int incrementLikes(UUID id);

    /**
     * Diminuisce di uno il contatore; il vincolo {@code ck_feed_posts_likes} e' la rete di sicurezza contro i
     * valori negativi (si chiama solo dopo aver cancellato davvero un like).
     */
    @Modifying
    @Query(nativeQuery = true, value = "update feed_posts set likes_count = likes_count - 1 where id = :id")
    int decrementLikes(UUID id);

    /**
     * Contatore dei like letto dal database, non dall'entity eventualmente gia' in cache dopo l'UPDATE.
     */
    @Query("select p.likesCount from FeedPost p where p.id = :id")
    int likesCountOf(UUID id);
}

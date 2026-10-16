package it.epicode.resonance.feed;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Accesso ai like dei post. Inserimento e cancellazione restituiscono le righe toccate: e' il dato che decide se
 * il contatore va aggiornato (progettazione, sezione 3.4).
 */
public interface PostLikeRepository extends JpaRepository<PostLike, PostLikeId> {

    /**
     * Fra i post indicati, gli id di quelli a cui l'utente ha messo like: serve a calcolare {@code likedByMe}
     * di una pagina con una sola query.
     */
    @Query("select l.id.postId from PostLike l where l.id.userId = :userId and l.id.postId in :postIds")
    List<UUID> findLikedPostIds(UUID userId, Collection<UUID> postIds);

    /**
     * Registra il like se non c'e' gia': 1 se ha inserito la riga, 0 se esisteva. Con {@code ON CONFLICT DO
     * NOTHING} due richieste simultanee dello stesso utente non danno errore e solo una inserisce.
     */
    @Modifying
    @Query(nativeQuery = true, value = """
            insert into post_likes (user_id, post_id) values (:userId, :postId)
            on conflict do nothing""")
    int insertIfAbsent(UUID userId, UUID postId);

    /**
     * Toglie il like: 1 se ha cancellato la riga, 0 se non c'era.
     */
    @Modifying
    @Query("delete from PostLike l where l.id.userId = :userId and l.id.postId = :postId")
    int deleteLike(UUID userId, UUID postId);
}

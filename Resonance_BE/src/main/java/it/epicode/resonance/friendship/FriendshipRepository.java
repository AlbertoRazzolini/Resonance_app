package it.epicode.resonance.friendship;

import it.epicode.resonance.user.UserStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Accesso alle amicizie; le letture con lock serializzano le modifiche della stessa coppia (progettazione,
 * sezione 6.14).
 */
public interface FriendshipRepository extends JpaRepository<Friendship, UUID> {

    /**
     * La riga della coppia in uno qualsiasi dei due versi, con lock di scrittura: al massimo una
     * ({@code uq_friendships_pair}). Richiede una transazione attiva.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select f from Friendship f
            where (f.requester.id = :a and f.addressee.id = :b)
               or (f.requester.id = :b and f.addressee.id = :a)""")
    Optional<Friendship> findForUpdateByPair(UUID a, UUID b);

    /**
     * La riga per id, con lock di scrittura. Richiede una transazione attiva.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from Friendship f where f.id = :id")
    Optional<Friendship> findForUpdateById(UUID id);

    // Gli stati si passano come parametri: un letterale enum nella JPQL diventa un cast al tipo "friendshipstatus",
    // che su PostgreSQL non esiste (il tipo e' friendship_status).

    /**
     * Righe nello stato indicato in cui compare l'utente, da una parte o dall'altra (elenco FRIENDS).
     */
    @EntityGraph(attributePaths = {"requester", "addressee"})
    @Query("""
            select f from Friendship f
            where f.status = :status and (f.requester.id = :me or f.addressee.id = :me)""")
    Page<Friendship> findByStatusInvolving(UUID me, FriendshipStatus status, Pageable pageable);

    /**
     * Righe nello stato indicato ricevute dall'utente (elenco INCOMING).
     */
    @EntityGraph(attributePaths = {"requester", "addressee"})
    @Query("select f from Friendship f where f.status = :status and f.addressee.id = :me")
    Page<Friendship> findByStatusReceivedBy(UUID me, FriendshipStatus status, Pageable pageable);

    /**
     * Richieste inviate dall'utente (elenco OUTGOING): quelle in attesa piu' i rifiuti ancora "mascherati", che a
     * chi ha chiesto appaiono come in attesa (rifiuto silenzioso).
     */
    @EntityGraph(attributePaths = {"requester", "addressee"})
    @Query("""
            select f from Friendship f
            where f.requester.id = :me
              and (f.status = :pending or (f.status = :declined and f.requestMasked = true))""")
    Page<Friendship> findSentBy(UUID me, FriendshipStatus pending, FriendshipStatus declined, Pageable pageable);

    /**
     * Se fra i due utenti c'e' una riga nello stato indicato, in qualunque verso.
     */
    @Query("""
            select count(f) > 0 from Friendship f
            where f.status = :status
              and ((f.requester.id = :a and f.addressee.id = :b) or (f.requester.id = :b and f.addressee.id = :a))""")
    boolean existsBetween(UUID a, UUID b, FriendshipStatus status);

    /**
     * Per ogni utente indicato che esiste: se e' disponibile (verificato e ACTIVE) e la sua riga con {@code me}, se
     * c'e'. Una sola query: l'unione e' sulle amicizie dell'utente che chiede.
     */
    @Query("""
            select new it.epicode.resonance.friendship.FriendshipRepository$RelationRow(
                u.id, u.status, u.emailVerified, f)
            from User u
            left join Friendship f
              on (f.requester.id = :me and f.addressee.id = u.id) or (f.addressee.id = :me and f.requester.id = u.id)
            where u.id in :otherIds""")
    List<RelationRow> findRelationRows(UUID me, Collection<UUID> otherIds);

    /**
     * Riga del risultato di {@link #findRelationRows}: l'utente, il suo stato e l'amicizia con chi chiede (nulla se
     * non c'e').
     */
    record RelationRow(UUID userId, UserStatus userStatus, boolean emailVerified, Friendship friendship) {

        boolean available() {
            return emailVerified && userStatus == UserStatus.ACTIVE;
        }
    }
}

package it.epicode.resonance.auth;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Accesso ai refresh token; la ricerca per hash blocca la riga per serializzare i refresh concorrenti.
 */
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    /**
     * Cerca per hash con lock di scrittura: due refresh simultanei con lo stesso cookie si mettono in
     * coda e il secondo trova il token gia' ruotato (progettazione, sezione 4.8). Richiede una transazione.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from RefreshToken t where t.tokenHash = :tokenHash")
    Optional<RefreshToken> findWithLockByTokenHash(String tokenHash);

    /**
     * Id dell'utente proprietario del token, senza lock e senza portare in memoria l'entity: serve a bloccare prima
     * la riga dell'utente e poi quella del token, nello stesso ordine di reset e sospensione (decisione 76, S1).
     */
    @Query("select t.userId from RefreshToken t where t.tokenHash = :tokenHash")
    Optional<UUID> findUserIdByTokenHash(String tokenHash);

    /**
     * Revoca in blocco tutti i token ancora validi di un utente (con un solo UPDATE) e restituisce
     * quanti ne ha revocati. Non imposta replaced_by: e' una revoca, non una rotazione.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update RefreshToken t set t.revoked = true, t.revokedAt = :now where t.userId = :userId and t.revoked = false")
    int revokeAllByUserId(UUID userId, Instant now);

    /**
     * Cancella i token con scadenza prima dell'istante indicato; restituisce quanti.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from RefreshToken t where t.expiresAt < :cutoff")
    int deleteByExpiresAtBefore(Instant cutoff);
}

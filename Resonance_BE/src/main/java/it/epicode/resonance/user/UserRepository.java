package it.epicode.resonance.user;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Accesso agli utenti; le versioni con lock servono alle operazioni che non devono sovrapporsi.
 */
public interface UserRepository extends JpaRepository<User, UUID> {

    /**
     * Cerca un utente per email, che deve essere gia' minuscola e senza spazi.
     */
    Optional<User> findByEmail(String email);

    /**
     * Come {@link #findByEmail}, ma con lock di scrittura: serializza le operazioni concorrenti
     * sullo stesso utente (progettazione, sezione 5.5). Richiede una transazione attiva.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.email = :email")
    Optional<User> findWithLockByEmail(String email);

    /**
     * Cerca per id con lock di scrittura, come {@link #findWithLockByEmail}.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findWithLockById(UUID id);

    /**
     * Stato dell'utente e suoi ruoli con una sola query (progettazione, sezione 5.2). Lista vuota se
     * l'utente non esiste.
     */
    @Query("""
            select new it.epicode.resonance.user.UserAccessRow(
                u.status, u.emailVerified, u.suspensionReason, u.suspendedUntil, r.id.role)
            from User u left join UserRole r on r.id.userId = u.id
            where u.id = :userId""")
    List<UserAccessRow> findAccessRowsById(UUID userId);

    /**
     * Riattivazione pigra (progettazione, sezione 5.5): riporta ad ACTIVE un utente sospeso la cui
     * scadenza e' passata e azzera i campi di sospensione. L'unico UPDATE e' atomico, quindi sicuro
     * anche con richieste concorrenti. Restituisce le righe modificate (0 o 1). E' una query nativa
     * perche' i literal enum della JPQL non si convertono nel tipo user_status di PostgreSQL.
     */
    @Modifying(clearAutomatically = true)
    @Query(nativeQuery = true, value = """
            update users
            set status = 'ACTIVE', suspended_at = null, suspended_by = null,
                suspension_reason = null, suspended_until = null
            where id = :id and status = 'SUSPENDED' and suspended_until <= :now""")
    int reactivateIfExpired(UUID id, Instant now);
}

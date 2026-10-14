package it.epicode.resonance.user;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

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
}

package it.epicode.resonance.auth;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

/**
 * Accesso ai codici email; il consumo del tentativo e' un UPDATE atomico (progettazione, sezione 4.5).
 */
public interface EmailCodeRepository extends JpaRepository<EmailCode, UUID> {

    /**
     * Riga di un utente per uno scopo, se esiste.
     */
    Optional<EmailCode> findByUserIdAndPurpose(UUID userId, EmailCodePurpose purpose);

    /**
     * Come {@link #findByUserIdAndPurpose}, ma con lock di scrittura: serializza gli invii concorrenti,
     * cosi' i limiti di 60 secondi e 5 invii non si aggirano con richieste parallele. Richiede una transazione.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from EmailCode c where c.userId = :userId and c.purpose = :purpose")
    Optional<EmailCode> findWithLockByUserIdAndPurpose(UUID userId, EmailCodePurpose purpose);

    /**
     * Consuma un tentativo con un solo UPDATE: la condizione {@code attempts < max} nello stesso statement
     * rende il limite valido anche con richieste parallele. Restituisce le righe modificate (0 = tentativi
     * esauriti o nessun codice attivo). Senza clearAutomatically: chi chiama ha altre entity nel contesto
     * (es. l'utente da verificare) che non devono staccarsi.
     */
    @Modifying(flushAutomatically = true)
    @Query("update EmailCode c set c.attempts = c.attempts + 1 where c.id = :id and c.attempts < :max and c.code is not null")
    int consumeAttempt(UUID id, int max);

    /**
     * Toglie il codice attivo e azzera i tentativi, lasciando i contatori degli invii: l'uso di un codice
     * non deve azzerare i limiti. Restituisce le righe modificate.
     */
    @Modifying(flushAutomatically = true)
    @Query("update EmailCode c set c.code = null, c.attempts = 0 where c.userId = :userId and c.purpose = :purpose")
    int clearCode(UUID userId, EmailCodePurpose purpose);
}

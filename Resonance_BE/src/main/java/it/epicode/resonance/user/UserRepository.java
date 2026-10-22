package it.epicode.resonance.user;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Accesso agli utenti; le versioni con lock servono alle operazioni che non devono sovrapporsi, le
 * specification all'elenco con filtri degli amministratori.
 */
public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {

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
     * Blocca la riga dell'utente e ne legge l'hash della password aggiornato: il login lo confronta con quello
     * usato per BCrypt, perche' un reset concluso nel frattempo l'ha cambiato (decisione 76, S1). Query nativa
     * di sola lettura: non porta in memoria l'entity, che sarebbe quella gia' caricata e quindi non aggiornata.
     * Richiede una transazione attiva.
     */
    @Query(nativeQuery = true, value = "select password_hash from users where id = :id for update")
    Optional<String> lockAndReadPasswordHashById(UUID id);

    /**
     * Ricerca utenti per nome (progettazione, sezione 6.5): {@code pattern} e' gia' un LIKE con i jolly di
     * {@code LikePattern.escape}, il backslash e' il carattere di escape. Solo utenti con email verificata e nello
     * stato indicato, escluso {@code me}; ordine fisso per nome senza maiuscole e poi id. Lo stato e' un parametro
     * perche' un letterale enum nella JPQL non si converte nel tipo user_status di PostgreSQL.
     */
    @Query(value = """
            select u from User u
            where u.emailVerified = true and u.status = :status and u.id <> :me
              and lower(u.displayName) like lower(:pattern) escape '\\'
            order by lower(u.displayName), u.id""",
            countQuery = """
            select count(u) from User u
            where u.emailVerified = true and u.status = :status and u.id <> :me
              and lower(u.displayName) like lower(:pattern) escape '\\'""")
    Page<User> searchByDisplayName(String pattern, UserStatus status, UUID me, Pageable pageable);

    /**
     * Vero se un utente qualsiasi, anche non verificato, ha gia' il nome senza distinguere le maiuscole. Stesso
     * confronto dell'indice uq_users_display_name_lower (decisione 96).
     */
    @Query("select count(u) > 0 from User u where lower(u.displayName) = lower(:name)")
    boolean existsByDisplayNameIgnoreCase(String name);

    /**
     * Come {@link #existsByDisplayNameIgnoreCase}, ma senza contare l'utente indicato: serve a chi tiene il proprio nome
     * e cambia solo le maiuscole, o si registra di nuovo con la stessa email non verificata.
     */
    @Query("select count(u) > 0 from User u where lower(u.displayName) = lower(:name) and u.id <> :excludedId")
    boolean existsByDisplayNameIgnoreCaseExcluding(String name, UUID excludedId);

    /**
     * Elimina gli utenti non verificati il cui ultimo invio del codice di verifica e' precedente a {@code before};
     * senza codice conta la creazione dell'account. Un solo DELETE atomico: una verifica che arriva nello stesso istante
     * ha il lock sulla riga e l'utente, riletto dopo, risulta gia' verificato. Righe collegate cancellate in cascata.
     * Nativa per il confronto con il tipo enum di PostgreSQL. Restituisce le righe eliminate.
     */
    @Modifying(clearAutomatically = true)
    @Query(nativeQuery = true, value = """
            delete from users u
            where u.email_verified = false
              and coalesce((select c.sent_at from email_codes c
                            where c.user_id = u.id and c.purpose = 'EMAIL_VERIFICATION'), u.created_at) < :before""")
    int deleteUnverifiedWithoutRecentCode(Instant before);

    /**
     * Quanti utenti hanno il ruolo e lo stato indicati, escluso l'utente indicato: serve al controllo "ultimo
     * SUPERADMIN" (progettazione, sezione 5.5).
     */
    @Query("""
            select count(u) from User u, UserRole r
            where r.id.userId = u.id and r.id.role = :role and u.status = :status and u.id <> :excludedId""")
    long countByRoleAndStatusExcluding(Role role, UserStatus status, UUID excludedId);

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

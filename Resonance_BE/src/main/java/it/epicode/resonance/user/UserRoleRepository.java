package it.epicode.resonance.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Set;
import java.util.UUID;

/**
 * Accesso ai ruoli degli utenti (tabella user_roles).
 */
public interface UserRoleRepository extends JpaRepository<UserRole, UserRoleId> {

    /**
     * Ruoli attivi di un utente. Ruoli e stato si leggono sempre dal database, mai dal token
     * (progettazione, sezione 5.2).
     */
    @Query("select r.id.role from UserRole r where r.id.userId = :userId")
    Set<Role> findRolesByUserId(UUID userId);

    /**
     * Assegna un ruolo solo se l'utente non lo ha gia' (progettazione, sezione 5.3). Un unico INSERT con
     * ON CONFLICT DO NOTHING rende l'attivazione idempotente anche con due richieste concorrenti: un
     * controllo seguito da un salvataggio darebbe un 409 alla seconda. Nativa perche' il parametro va
     * convertito nel tipo user_role di PostgreSQL. Restituisce le righe inserite (0 o 1).
     */
    @Modifying
    @Query(nativeQuery = true, value = """
            insert into user_roles (user_id, role) values (:userId, cast(:role as user_role))
            on conflict do nothing""")
    int addIfAbsent(UUID userId, String role);

    /**
     * Dice se esiste almeno un utente con il ruolo indicato; lo usa il bootstrap del SUPERADMIN
     * (progettazione, sezione 4.12).
     */
    boolean existsByIdRole(Role role);
}

package it.epicode.resonance.user;

import org.springframework.data.jpa.repository.JpaRepository;
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
     * Dice se esiste almeno un utente con il ruolo indicato; lo usa il bootstrap del SUPERADMIN
     * (progettazione, sezione 4.12).
     */
    boolean existsByIdRole(Role role);
}

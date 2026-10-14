package it.epicode.resonance.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Set;
import java.util.UUID;

public interface UserRoleRepository extends JpaRepository<UserRole, UserRoleId> {

    @Query("select r.id.role from UserRole r where r.id.userId = :userId")
    Set<Role> findRolesByUserId(UUID userId);

    // Usato dal bootstrap del SUPERADMIN: esiste gia' qualcuno con questo ruolo? (progettazione, sezione 4.12)
    boolean existsByIdRole(Role role);
}

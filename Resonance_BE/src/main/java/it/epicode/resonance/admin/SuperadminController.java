package it.epicode.resonance.admin;

import it.epicode.resonance.admin.dto.AdminUserResponse;
import it.epicode.resonance.auth.AuthenticatedUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Endpoint riservati al SUPERADMIN (progettazione, sezioni 5.4 e 6.10): nomina e revoca degli ADMIN. L'accesso lo
 * decide {@code SecurityConfig}; il ruolo SUPERADMIN non si assegna mai via API.
 */
@RestController
@RequestMapping("/api/superadmin/users")
public class SuperadminController {

    private final AdminUserService adminUserService;

    public SuperadminController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    /**
     * Nomina l'utente ADMIN. Idempotente.
     */
    @PostMapping("/{id}/admin")
    public AdminUserResponse grantAdmin(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser superadmin) {
        return adminUserService.grantAdmin(id, superadmin);
    }

    /**
     * Revoca il ruolo ADMIN all'utente. Idempotente.
     */
    @DeleteMapping("/{id}/admin")
    public AdminUserResponse revokeAdmin(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser superadmin) {
        return adminUserService.revokeAdmin(id, superadmin);
    }
}

package it.epicode.resonance.admin;

import it.epicode.resonance.admin.dto.AdminUserResponse;
import it.epicode.resonance.admin.dto.SuspendUserRequest;
import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.user.UserStatus;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Endpoint di amministrazione degli utenti (progettazione, sezione 6.10). L'accesso e' riservato a ADMIN e
 * SUPERADMIN da {@code SecurityConfig}; la regola dei livelli (sezione 5.6) la applica il service.
 */
@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    /**
     * Elenco paginato degli utenti, con ricerca su email e nome e filtro sullo stato (sezione 6.10).
     */
    @GetMapping
    public PageResponse<AdminUserResponse> list(@RequestParam(required = false) String search,
                                                @RequestParam(required = false) UserStatus status,
                                                @Valid PageParams params) {
        return adminUserService.list(search, status, params);
    }

    /**
     * Sospende l'utente, o aggiorna i dettagli di una sospensione in corso (sezione 5.5).
     */
    @PostMapping("/{id}/suspension")
    public AdminUserResponse suspend(@PathVariable UUID id, @Valid @RequestBody SuspendUserRequest request,
                                     @AuthenticationPrincipal AuthenticatedUser admin) {
        return adminUserService.suspend(id, request, admin);
    }

    /**
     * Riattiva l'utente prima della scadenza (sezione 5.5). Idempotente.
     */
    @DeleteMapping("/{id}/suspension")
    public AdminUserResponse reactivate(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser admin) {
        return adminUserService.reactivate(id, admin);
    }
}

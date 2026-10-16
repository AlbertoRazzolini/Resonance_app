package it.epicode.resonance.moderation;

import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.moderation.dto.HiddenContentResponse;
import it.epicode.resonance.moderation.dto.HideContentRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Endpoint di moderazione dei contenuti (progettazione, sezioni 5.7 e 6.10). L'accesso e' riservato a ADMIN e
 * SUPERADMIN da {@code SecurityConfig}; la regola dei livelli la applica il service.
 */
@RestController
@RequestMapping("/api/admin/moderation")
public class ModerationController {

    private final ModerationService moderationService;

    public ModerationController(ModerationService moderationService) {
        this.moderationService = moderationService;
    }

    /**
     * Nasconde il contenuto; il motivo e' obbligatorio.
     */
    @PostMapping("/{type}/{id}/hide")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void hide(@PathVariable ModeratedContentType type, @PathVariable UUID id,
                     @Valid @RequestBody HideContentRequest request, @AuthenticationPrincipal AuthenticatedUser admin) {
        moderationService.hide(type, id, request.reason(), admin);
    }

    /**
     * Elenco paginato dei contenuti nascosti di un tipo (da un admin o cancellati dal proprietario).
     */
    @GetMapping("/{type}/hidden")
    public PageResponse<HiddenContentResponse> hidden(@PathVariable ModeratedContentType type,
                                                      @Valid PageParams params) {
        return moderationService.listHidden(type, params);
    }

    /**
     * Ripristina un contenuto nascosto da un admin.
     */
    @PostMapping("/{type}/{id}/restore")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void restore(@PathVariable ModeratedContentType type, @PathVariable UUID id,
                        @AuthenticationPrincipal AuthenticatedUser admin) {
        moderationService.restore(type, id, admin);
    }
}

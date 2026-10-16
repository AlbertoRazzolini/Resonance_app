package it.epicode.resonance.friendship;

import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.friendship.dto.UserSearchResult;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Ricerca utenti (progettazione, sezione 6.5): richiede il login. Sta nel package {@code friendship} perche' serve a
 * trovare chi aggiungere come amico; il percorso e' sotto {@code /api/users} e in {@code SecurityConfig} la sua
 * regola precede quella pubblica di {@code GET /api/users/{id}}.
 */
@RestController
@RequestMapping("/api/users/search")
public class UserSearchController {

    private final UserSearchService userSearchService;

    public UserSearchController(UserSearchService userSearchService) {
        this.userSearchService = userSearchService;
    }

    /**
     * Cerca per sottostringa del nome. {@code q} e' obbligatorio (2-50 caratteri dopo il trim): se manca o non e'
     * valido e' un 400.
     */
    @GetMapping
    public PageResponse<UserSearchResult> search(@AuthenticationPrincipal AuthenticatedUser user,
                                                 @RequestParam String q, @Valid PageParams params) {
        return userSearchService.search(user.id(), q, params);
    }
}

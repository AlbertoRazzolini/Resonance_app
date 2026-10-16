package it.epicode.resonance.friendship;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.LikePattern;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.common.RateLimit;
import it.epicode.resonance.common.RateLimitService;
import it.epicode.resonance.friendship.dto.FriendshipSummary;
import it.epicode.resonance.friendship.dto.UserSearchResult;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Ricerca utenti per nome (progettazione, sezione 6.5; decisione 59): serve a trovare chi aggiungere come amico.
 * Ogni risultato porta lo stato dell'amicizia visto da chi cerca, calcolato per tutta la pagina con una sola query.
 */
@Service
public class UserSearchService {

    private static final int MIN_LENGTH = 2;
    private static final int MAX_LENGTH = 50;

    private final UserRepository users;
    private final FriendshipService friendshipService;
    private final RateLimitService rateLimits;

    public UserSearchService(UserRepository users, FriendshipService friendshipService, RateLimitService rateLimits) {
        this.users = users;
        this.friendshipService = friendshipService;
        this.rateLimits = rateLimits;
    }

    /**
     * Cerca per sottostringa del nome. Il limite si consuma per primo, come per le richieste di amicizia: conta
     * anche se {@code q} poi risulta non valido (decisione 64). Poi {@code q}, dopo il trim, deve avere 2-50
     * caratteri, altrimenti 400.
     */
    @Transactional(readOnly = true)
    public PageResponse<UserSearchResult> search(UUID me, String q, PageParams params) {
        rateLimits.consume(RateLimit.USER_SEARCH, me.toString());
        String text = q == null ? "" : q.strip();
        if (text.length() < MIN_LENGTH || text.length() > MAX_LENGTH) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Uno o più parametri non sono validi",
                    Map.of("q", "Deve avere da " + MIN_LENGTH + " a " + MAX_LENGTH + " caratteri"));
        }
        String pattern = "%" + LikePattern.escape(text.toLowerCase(Locale.ROOT)) + "%";
        // L'ordine sta nella query (lower(display_name), id): il Pageable porta solo pagina e dimensione.
        Page<User> page = users.searchByDisplayName(pattern, UserStatus.ACTIVE, me, params.toPageable(Sort.unsorted()));

        Map<UUID, FriendshipRelation> relations = friendshipService.relationsFor(me,
                page.getContent().stream().map(User::getId).toList());
        return PageResponse.from(page.map(user -> UserSearchResult.from(user,
                FriendshipSummary.from(relations.getOrDefault(user.getId(), FriendshipRelation.NONE)))));
    }
}

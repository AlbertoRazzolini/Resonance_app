package it.epicode.resonance.moderation;

import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.collab.CollabPostRepository;
import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.moderation.dto.HiddenContentResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import it.epicode.resonance.event.IndieEventRepository;
import it.epicode.resonance.event.OfficialConcertRepository;
import it.epicode.resonance.feed.FeedPostRepository;
import it.epicode.resonance.user.PlatformLevelPolicy;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRoleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Moderazione degli admin sui quattro tipi di contenuto (progettazione, sezione 5.7): nasconde e ripristina
 * applicando la regola dei livelli (sezione 5.6) all'autore del contenuto. Non cancella mai nulla davvero.
 */
@Service
public class ModerationService {

    /**
     * Vista comune dei quattro tipi: l'autore e lo stato di moderazione (e' l'oggetto dell'entity, quindi le
     * modifiche le salva la transazione).
     */
    private record Content(User author, Moderation moderation) {
    }

    // Ordine fisso dell'elenco (sezione 6.1): dal nascosto piu' di recente, a parita' per id decrescente.
    private static final Sort HIDDEN_ORDER = Sort.by(Sort.Order.desc("moderation.hiddenAt"), Sort.Order.desc("id"));

    private final OfficialConcertRepository concerts;
    private final IndieEventRepository indieEvents;
    private final FeedPostRepository feedPosts;
    private final CollabPostRepository collabPosts;
    private final UserRoleRepository userRoles;
    private final PlatformLevelPolicy policy;
    private final Clock clock;

    public ModerationService(OfficialConcertRepository concerts, IndieEventRepository indieEvents,
                             FeedPostRepository feedPosts, CollabPostRepository collabPosts,
                             UserRoleRepository userRoles, PlatformLevelPolicy policy, Clock clock) {
        this.concerts = concerts;
        this.indieEvents = indieEvents;
        this.feedPosts = feedPosts;
        this.collabPosts = collabPosts;
        this.userRoles = userRoles;
        this.policy = policy;
        this.clock = clock;
    }

    /**
     * Nasconde un contenuto con il motivo dato. 404 se non esiste, 403 se l'autore ha un livello pari o superiore,
     * 409 CONTENT_ALREADY_HIDDEN se e' gia' nascosto (da un admin o dal proprietario).
     */
    @Transactional
    public void hide(ModeratedContentType type, UUID id, String reason, AuthenticatedUser admin) {
        Content content = load(type, id);
        requireCanActOnAuthor(content, admin);
        if (content.moderation().isHidden()) {
            throw new AppException(ErrorCode.CONTENT_ALREADY_HIDDEN, "Il contenuto e' gia' nascosto");
        }
        content.moderation().hide(admin.id(), reason, clock.instant());
    }

    /**
     * Ripristina un contenuto nascosto da un admin. 409 CONTENT_NOT_HIDDEN se e' visibile, 409
     * RESTORE_NOT_ALLOWED se l'ha cancellato il proprietario (sezione 5.7).
     */
    @Transactional
    public void restore(ModeratedContentType type, UUID id, AuthenticatedUser admin) {
        Content content = load(type, id);
        requireCanActOnAuthor(content, admin);
        if (!content.moderation().isHidden()) {
            throw new AppException(ErrorCode.CONTENT_NOT_HIDDEN, "Il contenuto non e' nascosto");
        }
        if (content.moderation().hiddenByAuthor(content.author().getId())) {
            throw new AppException(ErrorCode.RESTORE_NOT_ALLOWED,
                    "Il contenuto e' stato cancellato dal proprietario e non si puo' ripristinare");
        }
        content.moderation().restore();
    }

    /**
     * Elenco dei contenuti nascosti di un tipo, dal piu' recente: comprende sia quelli moderati da un admin sia
     * quelli cancellati dal proprietario (sezione 5.7).
     */
    @Transactional(readOnly = true)
    public PageResponse<HiddenContentResponse> listHidden(ModeratedContentType type, PageParams params) {
        Pageable pageable = params.toPageable(HIDDEN_ORDER);
        Page<HiddenContentResponse> page = switch (type) {
            case OFFICIAL_CONCERT -> concerts.findByModerationHiddenAtIsNotNull(pageable)
                    .map(c -> HiddenContentResponse.of(c.getId(), c.getHost(), c.getTitle(), c.getModeration()));
            case INDIE_EVENT -> indieEvents.findByModerationHiddenAtIsNotNull(pageable)
                    .map(e -> HiddenContentResponse.of(e.getId(), e.getMusician(), e.getTitle(), e.getModeration()));
            case FEED_POST -> feedPosts.findByModerationHiddenAtIsNotNull(pageable)
                    .map(p -> HiddenContentResponse.of(p.getId(), p.getAuthor(), p.getBody(), p.getModeration()));
            case COLLAB_POST -> collabPosts.findByModerationHiddenAtIsNotNull(pageable)
                    .map(p -> HiddenContentResponse.of(p.getId(), p.getMusician(), p.getTitle(), p.getModeration()));
        };
        return PageResponse.from(page);
    }

    /**
     * Contenuto per id, nascosto o no (l'admin vede anche i nascosti). 404 se non esiste.
     */
    private Content load(ModeratedContentType type, UUID id) {
        Optional<Content> found = switch (type) {
            case OFFICIAL_CONCERT -> concerts.findWithHostById(id)
                    .map(concert -> new Content(concert.getHost(), concert.getModeration()));
            case INDIE_EVENT -> indieEvents.findWithMusicianById(id)
                    .map(event -> new Content(event.getMusician(), event.getModeration()));
            case FEED_POST -> feedPosts.findWithAuthorById(id)
                    .map(post -> new Content(post.getAuthor(), post.getModeration()));
            case COLLAB_POST -> collabPosts.findWithMusicianById(id)
                    .map(post -> new Content(post.getMusician(), post.getModeration()));
        };
        return found.orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Contenuto non trovato"));
    }

    /**
     * Regola dei livelli sull'autore (sezione 5.6): i ruoli dell'autore si leggono dal database.
     */
    private void requireCanActOnAuthor(Content content, AuthenticatedUser admin) {
        UUID authorId = content.author().getId();
        Set<Role> authorRoles = userRoles.findRolesByUserId(authorId);
        policy.requireCanActOn(admin.id(), admin.roles(), authorId, authorRoles);
    }
}

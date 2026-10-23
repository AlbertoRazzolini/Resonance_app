package it.epicode.resonance.collab;

import it.epicode.resonance.auth.AccessStatus;
import it.epicode.resonance.auth.UserAccessService;
import it.epicode.resonance.chat.ChatConversation;
import it.epicode.resonance.chat.ChatMessage;
import it.epicode.resonance.chat.ChatService;
import it.epicode.resonance.chat.ChatUnlockSource;
import it.epicode.resonance.collab.dto.ApplicationResponse;
import it.epicode.resonance.collab.dto.CollabPostResponse;
import it.epicode.resonance.collab.dto.CreateCollabPostRequest;
import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.common.RateLimit;
import it.epicode.resonance.common.RateLimitService;
import it.epicode.resonance.notification.NotificationService;
import it.epicode.resonance.notification.NotificationType;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.UUID;

/**
 * Annunci di collaborazione (progettazione, sezioni 5.7 e 6.7): creazione, lista pubblica, chiusura e
 * cancellazione del proprietario e candidature.
 */
@Service
public class CollabService {

    private final CollabPostRepository posts;
    private final UserRepository users;
    private final UserAccessService userAccess;
    private final ChatService chat;
    private final RateLimitService rateLimits;
    private final NotificationService notifications;
    private final Clock clock;

    public CollabService(CollabPostRepository posts, UserRepository users, UserAccessService userAccess,
                         ChatService chat, RateLimitService rateLimits, NotificationService notifications,
                         Clock clock) {
        this.posts = posts;
        this.users = users;
        this.userAccess = userAccess;
        this.chat = chat;
        this.rateLimits = rateLimits;
        this.notifications = notifications;
        this.clock = clock;
    }

    /**
     * Crea un annuncio aperto. Il ruolo MUSICIAN e' gia' verificato da {@code SecurityConfig}.
     */
    @Transactional
    public CollabPostResponse create(UUID musicianId, CreateCollabPostRequest request) {
        User musician = users.findById(musicianId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Utente non trovato"));
        CollabPost post = new CollabPost(musician, request.title(), request.description(), request.roleNeeded());
        post.setGenreTags(request.genreTags());
        post.setLocation(request.location());
        return CollabPostResponse.from(posts.saveAndFlush(post));
    }

    /**
     * Lista pubblica: solo annunci aperti e non nascosti, dal piu' recente (sezioni 3.5 e 6.7). A parita' di
     * data vince l'id, per un ordine stabile fra le pagine.
     */
    @Transactional(readOnly = true)
    public PageResponse<CollabPostResponse> list(PageParams params) {
        Sort order = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
        Page<CollabPost> page = posts.findByOpenTrueAndModerationHiddenAtIsNull(params.toPageable(order));
        return PageResponse.from(page.map(CollabPostResponse::from));
    }

    /**
     * Annunci del chiamante, chiusi compresi, dal piu' recente; i nascosti no, nemmeno per il proprietario
     * (sezione 6.7, decisione 77).
     */
    @Transactional(readOnly = true)
    public PageResponse<CollabPostResponse> mine(UUID musicianId, PageParams params) {
        Sort order = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
        Page<CollabPost> page = posts.findByMusicianIdAndModerationHiddenAtIsNull(musicianId,
                params.toPageable(order));
        return PageResponse.from(page.map(CollabPostResponse::from));
    }

    /**
     * Dettaglio pubblico: vale anche per gli annunci chiusi, mentre uno nascosto e' un 404 per tutti (sezione 3.5).
     */
    @Transactional(readOnly = true)
    public CollabPostResponse get(UUID id) {
        return CollabPostResponse.from(findVisible(id));
    }

    /**
     * Chiude l'annuncio (sezione 6.7). E' idempotente: chiudere un annuncio gia' chiuso restituisce lo stesso
     * esito. Solo il proprietario puo' chiuderlo.
     */
    @Transactional
    public CollabPostResponse close(UUID id, UUID userId) {
        CollabPost post = findVisible(id);
        requireOwner(post, userId);
        post.setOpen(false);
        return CollabPostResponse.from(post);
    }

    /**
     * Cancellazione del proprietario (sezione 5.7): nasconde l'annuncio, anche se chiuso, con il motivo
     * facoltativo. Un annuncio nascosto e' un 404; per quello altrui (admin compresi, che moderano con gli
     * endpoint dedicati) NOT_OWNER.
     */
    @Transactional
    public void delete(UUID id, String reason, UUID userId) {
        CollabPost post = findVisible(id);
        requireOwner(post, userId);
        post.getModeration().hide(userId, reason, clock.instant());
    }

    /**
     * Candidatura a un annuncio (sezione 6.7), controlli nell'ordine: annuncio non nascosto con autore attivo
     * (404), aperto (409 {@code COLLAB_CLOSED}), autore diverso dal candidato (400 {@code CANNOT_APPLY_OWN_POST}),
     * candidatura non ancora fatta (409 {@code COLLAB_ALREADY_APPLIED}, decisione 99), limite
     * {@code COLLAB_APPLICATIONS} per ultimo, cosi' i rifiuti non lo consumano. Poi, nella stessa
     * transazione: conversazione senza controllo di amicizia, sblocco {@code COLLAB_POST} (la riga dello sblocco
     * e' anche il segno della candidatura fatta: l'insert atomico respinge la seconda richiesta insieme alla
     * prima) e messaggio con il titolo. Dopo il commit arrivano il messaggio a
     * entrambi e la notifica {@code COLLAB_APPLICATION} all'autore, salvata nella stessa transazione (decisione 97), non anche
     * NEW_MESSAGE (sezione 7.6).
     */
    @Transactional
    public ApplicationResponse apply(UUID postId, UUID applicantId, String message) {
        CollabPost post = findVisible(postId);
        User author = post.getMusician();
        // Un autore sospeso o non verificato non esiste per gli altri, come il destinatario di POST /api/chats
        // (decisioni 66 e 67).
        if (userAccess.resolve(author.getId()).status() != AccessStatus.ACTIVE) {
            throw new AppException(ErrorCode.NOT_FOUND, "Annuncio non trovato");
        }
        if (!post.isOpen()) {
            throw new AppException(ErrorCode.COLLAB_CLOSED, "L'annuncio e' chiuso");
        }
        if (author.getId().equals(applicantId)) {
            throw new AppException(ErrorCode.CANNOT_APPLY_OWN_POST, "Non puoi candidarti al tuo annuncio");
        }
        if (chat.hasUnlock(applicantId, author.getId(), ChatUnlockSource.COLLAB_POST, postId)) {
            throw alreadyApplied();
        }
        rateLimits.consume(RateLimit.COLLAB_APPLICATIONS, applicantId.toString());

        ChatMessage saved = chat.sendFirstUnlockedMessage(applicantId, author.getId(), ChatUnlockSource.COLLAB_POST,
                postId, "Candidatura per \u00ab" + post.getTitle() + "\u00bb:\n" + message)
                // Perde la corsa con un'altra richiesta dello stesso utente: la transazione si annulla.
                .orElseThrow(CollabService::alreadyApplied);
        ChatConversation conversation = saved.getConversation();
        User applicant = conversation.otherThan(author.getId());
        notifications.create(author, applicant, NotificationType.COLLAB_APPLICATION, postId, saved.getSentAt());
        return new ApplicationResponse(conversation.getId(), saved.getId());
    }

    private static AppException alreadyApplied() {
        return new AppException(ErrorCode.COLLAB_ALREADY_APPLIED, "Ti sei gia' candidato a questo annuncio");
    }

    /**
     * Annuncio non nascosto, chiuso o aperto. Altrimenti 404.
     */
    private CollabPost findVisible(UUID id) {
        return posts.findWithMusicianById(id)
                .filter(found -> !found.getModeration().isHidden())
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Annuncio non trovato"));
    }

    private void requireOwner(CollabPost post, UUID userId) {
        if (!post.getMusician().getId().equals(userId)) {
            throw new AppException(ErrorCode.NOT_OWNER, "Non sei il proprietario di questo annuncio");
        }
    }
}

package it.epicode.resonance.collab;

import it.epicode.resonance.collab.dto.CollabPostResponse;
import it.epicode.resonance.collab.dto.CreateCollabPostRequest;
import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
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
 * cancellazione del proprietario. Le candidature sono in F5-03.
 */
@Service
public class CollabService {

    private final CollabPostRepository posts;
    private final UserRepository users;
    private final Clock clock;

    public CollabService(CollabPostRepository posts, UserRepository users, Clock clock) {
        this.posts = posts;
        this.users = users;
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

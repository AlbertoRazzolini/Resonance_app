package it.epicode.resonance.feed;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.feed.dto.CreateFeedPostRequest;
import it.epicode.resonance.feed.dto.FeedPostResponse;
import it.epicode.resonance.feed.dto.LikeStatusResponse;
import it.epicode.resonance.geo.NearbyQuery;
import it.epicode.resonance.geo.NearbyRow;
import it.epicode.resonance.notification.NotificationService;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Feed della community (progettazione, sezioni 3.4, 5.7, 6.8 e 10.2): creazione, lista pubblica con filtro per
 * raggio facoltativo, dettaglio, like e unlike atomici e cancellazione del proprietario.
 */
@Service
public class FeedService {

    private final FeedPostRepository posts;
    private final PostLikeRepository likes;
    private final UserRepository users;
    private final NotificationService notifications;
    private final Clock clock;

    public FeedService(FeedPostRepository posts, PostLikeRepository likes, UserRepository users,
                       NotificationService notifications, Clock clock) {
        this.posts = posts;
        this.likes = likes;
        this.users = users;
        this.notifications = notifications;
        this.clock = clock;
    }

    /**
     * Pubblica un post: lo puo' fare qualunque utente autenticato. Le coordinate, se presenti, sono entrambe
     * (lo garantisce la richiesta).
     */
    @Transactional
    public FeedPostResponse create(UUID authorId, CreateFeedPostRequest request) {
        User author = users.findById(authorId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Utente non trovato"));
        FeedPost post = new FeedPost(author, request.body());
        post.setImageUrl(request.imageUrl());
        post.setLatitude(request.latitude());
        post.setLongitude(request.longitude());
        return FeedPostResponse.from(posts.saveAndFlush(post), false, null);
    }

    /**
     * Lista pubblica dal piu' recente (sezioni 3.5 e 6.8), solo post non nascosti. Con {@code lat}, {@code lng} e
     * {@code radiusKm} (tutti o nessuno) restano i post con coordinate entro il raggio, con la distanza; senza,
     * tutti. Il centro viene sempre dalla richiesta, mai dal profilo (sezione 10.2). {@code viewerId} e' null
     * per chi non e' autenticato: {@code likedByMe} resta falso.
     */
    @Transactional(readOnly = true)
    public PageResponse<FeedPostResponse> list(Double lat, Double lng, Double radiusKm, PageParams params,
                                               UUID viewerId) {
        NearbyQuery query = nearbyQueryOrNull(lat, lng, radiusKm);
        if (query == null) {
            Sort order = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
            Page<FeedPost> page = posts.findByModerationHiddenAtIsNull(params.toPageable(order));
            Set<UUID> liked = likedAmong(viewerId, page.getContent());
            return PageResponse.from(page.map(post -> FeedPostResponse.from(post, liked.contains(post.getId()), null)));
        }
        return nearby(query, params, viewerId);
    }

    /**
     * Post del chiamante dal piu' recente; i nascosti no, nemmeno per il proprietario (sezione 6.8, decisione 77).
     * {@code likedByMe} e' calcolato per il chiamante e {@code distanceKm} resta nullo.
     */
    @Transactional(readOnly = true)
    public PageResponse<FeedPostResponse> mine(UUID authorId, PageParams params) {
        Sort order = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
        Page<FeedPost> page = posts.findByAuthorIdAndModerationHiddenAtIsNull(authorId, params.toPageable(order));
        Set<UUID> liked = likedAmong(authorId, page.getContent());
        return PageResponse.from(page.map(post -> FeedPostResponse.from(post, liked.contains(post.getId()), null)));
    }

    /**
     * Dettaglio pubblico: un post nascosto e' un 404 per tutti (sezione 3.5).
     */
    @Transactional(readOnly = true)
    public FeedPostResponse get(UUID id, UUID viewerId) {
        FeedPost post = findVisible(id);
        boolean likedByMe = viewerId != null && likes.existsById(new PostLikeId(viewerId, id));
        return FeedPostResponse.from(post, likedByMe, null);
    }

    /**
     * Cancellazione del proprietario (sezione 5.7): nasconde il post con il motivo facoltativo. Un post nascosto
     * e' un 404; per quello altrui (admin compresi, che moderano con gli endpoint dedicati) NOT_OWNER.
     */
    @Transactional
    public void delete(UUID id, String reason, UUID userId) {
        FeedPost post = findVisible(id);
        if (!post.getAuthor().getId().equals(userId)) {
            throw new AppException(ErrorCode.NOT_OWNER, "Non sei il proprietario di questo post");
        }
        post.getModeration().hide(userId, reason, clock.instant());
    }

    /**
     * Mette like (sezione 3.4): inserisce la riga solo se manca e, solo se l'ha inserita, aumenta il contatore con
     * un UPDATE del database. E' idempotente: un secondo like dello stesso utente non cambia nulla. Un post
     * nascosto o inesistente e' un 404 (sezione 3.5). Solo un inserimento effettivo, e non sul proprio post,
     * salva e notifica NEW_LIKE all'autore dopo il commit, una sola volta per coppia autore-post (decisione 97).
     */
    @Transactional
    public LikeStatusResponse like(UUID postId, UUID userId) {
        UUID authorId = findVisible(postId).getAuthor().getId();
        if (likes.insertIfAbsent(userId, postId) == 1) {
            posts.incrementLikes(postId);
            if (!authorId.equals(userId)) {
                User actor = users.findById(userId)
                        .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Utente non trovato"));
                notifications.createLikeOnce(users.getReferenceById(authorId), actor, postId);
            }
        }
        return new LikeStatusResponse(posts.likesCountOf(postId), true);
    }

    /**
     * Toglie il like (sezione 3.4): cancella la riga e, solo se esisteva, diminuisce il contatore. Idempotente
     * come {@link #like}, quindi il contatore non scende mai sotto lo zero.
     */
    @Transactional
    public LikeStatusResponse unlike(UUID postId, UUID userId) {
        requireVisible(postId);
        if (likes.deleteLike(userId, postId) == 1) {
            posts.decrementLikes(postId);
        }
        return new LikeStatusResponse(posts.likesCountOf(postId), false);
    }

    private void requireVisible(UUID postId) {
        if (!posts.existsByIdAndModerationHiddenAtIsNull(postId)) {
            throw new AppException(ErrorCode.NOT_FOUND, "Post non trovato");
        }
    }

    /**
     * Pagina del filtro per raggio. La query nativa restituisce solo id e distanza; i post e i loro autori si
     * caricano con una seconda query e si rimettono nell'ordine della prima.
     */
    private PageResponse<FeedPostResponse> nearby(NearbyQuery query, PageParams params, UUID viewerId) {
        long offset = (long) params.page() * params.size();
        List<NearbyRow> rows = posts.findNearby(query.lat(), query.lng(), query.radiusKm(),
                query.minLat(), query.maxLat(), query.minLng(), query.maxLng(), params.size(), offset);
        long total = posts.countNearby(query.lat(), query.lng(), query.radiusKm(), query.minLat(),
                query.maxLat(), query.minLng(), query.maxLng());

        List<UUID> ids = rows.stream().map(NearbyRow::getId).toList();
        Map<UUID, FeedPost> byId = posts.findByIdIn(ids).stream()
                .collect(Collectors.toMap(FeedPost::getId, Function.identity()));
        Set<UUID> liked = likedAmong(viewerId, byId.values());
        // Un post nascosto fra le due query e' gia' fuori dalla pagina: lo si salta.
        List<FeedPostResponse> content = rows.stream()
                .filter(row -> byId.containsKey(row.getId()))
                .map(row -> FeedPostResponse.from(byId.get(row.getId()), liked.contains(row.getId()),
                        row.getDistanceKm()))
                .toList();
        return PageResponse.from(new PageImpl<>(content, params.toPageable(Sort.unsorted()), total));
    }

    /**
     * Fra i post indicati, quelli a cui l'utente ha messo like, con una sola query; vuoto se non e' autenticato.
     */
    private Set<UUID> likedAmong(UUID viewerId, Collection<FeedPost> pagePosts) {
        if (viewerId == null || pagePosts.isEmpty()) {
            return Set.of();
        }
        List<UUID> ids = pagePosts.stream().map(FeedPost::getId).toList();
        return Set.copyOf(likes.findLikedPostIds(viewerId, ids));
    }

    /**
     * Il filtro per raggio vale solo con tutti e tre i parametri: nessuno = nessun filtro (null), alcuni = 400
     * con i parametri mancanti; i valori fuori range li rifiuta {@link NearbyQuery}.
     */
    private NearbyQuery nearbyQueryOrNull(Double lat, Double lng, Double radiusKm) {
        if (lat == null && lng == null && radiusKm == null) {
            return null;
        }
        Map<String, String> missing = new LinkedHashMap<>();
        if (lat == null) {
            missing.put("lat", "obbligatoria con il filtro per raggio");
        }
        if (lng == null) {
            missing.put("lng", "obbligatoria con il filtro per raggio");
        }
        if (radiusKm == null) {
            missing.put("radiusKm", "obbligatorio con il filtro per raggio");
        }
        if (!missing.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR,
                    "Il filtro per raggio richiede lat, lng e radiusKm insieme", missing);
        }
        return new NearbyQuery(lat, lng, radiusKm);
    }

    /**
     * Post non nascosto. Altrimenti 404.
     */
    private FeedPost findVisible(UUID id) {
        return posts.findWithAuthorById(id)
                .filter(found -> !found.getModeration().isHidden())
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Post non trovato"));
    }
}

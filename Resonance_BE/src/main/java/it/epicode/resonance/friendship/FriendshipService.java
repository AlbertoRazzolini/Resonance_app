package it.epicode.resonance.friendship;

import it.epicode.resonance.auth.AccessStatus;
import it.epicode.resonance.auth.UserAccessService;
import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.RateLimit;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.common.RateLimitService;
import it.epicode.resonance.friendship.dto.FriendshipListType;
import it.epicode.resonance.friendship.dto.FriendshipResponse;
import it.epicode.resonance.notification.NotificationService;
import it.epicode.resonance.notification.NotificationType;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Amicizie con rifiuto silenzioso (progettazione, sezione 6.14; decisione 59): richiesta, accettazione, rifiuto,
 * annullamento, rimozione ed elenchi. Ogni modifica legge la riga con un lock, cosi' due azioni sulla stessa
 * coppia non si sovrappongono.
 */
@Service
public class FriendshipService {

    private final FriendshipRepository friendships;
    private final UserRepository users;
    private final UserAccessService userAccess;
    private final RateLimitService rateLimits;
    private final NotificationService notifications;
    private final Clock clock;

    public FriendshipService(FriendshipRepository friendships, UserRepository users, UserAccessService userAccess,
                             RateLimitService rateLimits, NotificationService notifications, Clock clock) {
        this.friendships = friendships;
        this.users = users;
        this.userAccess = userAccess;
        this.rateLimits = rateLimits;
        this.notifications = notifications;
        this.clock = clock;
    }

    /**
     * Chiede l'amicizia a {@code addresseeId}, nell'ordine di §6.14: limite (che conta anche se poi fallisce), se
     * stessi, destinatario, riga della coppia sotto lock. Una riga gia' presente si riapre o si rifiuta con il 409
     * che corrisponde a cio' che il richiedente vede.
     */
    @Transactional
    public FriendshipResponse request(UUID me, UUID addresseeId) {
        rateLimits.consume(RateLimit.FRIEND_REQUESTS, me.toString());
        if (me.equals(addresseeId)) {
            throw new AppException(ErrorCode.CANNOT_FRIEND_SELF, "Non puoi chiedere l'amicizia a te stesso");
        }
        // Un destinatario non verificato o sospeso non esiste per gli altri (e applica la riattivazione pigra).
        if (userAccess.resolve(addresseeId).status() != AccessStatus.ACTIVE) {
            throw new AppException(ErrorCode.NOT_FOUND, "Utente non trovato");
        }
        User addressee = users.findById(addresseeId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Utente non trovato"));
        Instant now = clock.instant();

        Friendship row = friendships.findForUpdateByPair(me, addresseeId).orElse(null);
        if (row == null) {
            // Due richieste incrociate nello stesso istante: la seconda viola uq_friendships_pair e con il flush
            // l'errore arriva subito come 409 CONFLICT.
            User requester = users.getReferenceById(me);
            row = friendships.saveAndFlush(new Friendship(requester, addressee, FriendshipStatus.PENDING, now));
            notifications.create(addressee, requester, NotificationType.FRIEND_REQUEST, row.getId(), now);
            return FriendshipResponse.from(row, me);
        }

        boolean closedByMe = me.equals(row.getClosedBy());
        switch (row.getStatus()) {
            case PENDING -> throw new AppException(
                    row.getRequester().getId().equals(me)
                            ? ErrorCode.FRIEND_REQUEST_ALREADY_SENT : ErrorCode.FRIEND_REQUEST_ALREADY_RECEIVED,
                    row.getRequester().getId().equals(me)
                            ? "Hai gia' inviato una richiesta a questo utente"
                            : "Questo utente ti ha gia' chiesto l'amicizia");
            case ACCEPTED -> throw new AppException(ErrorCode.ALREADY_FRIENDS, "Siete gia' amici");
            case CANCELLED -> reopen(row, me, addressee, now);
            case DECLINED -> {
                if (closedByMe) {
                    reopen(row, me, addressee, now);
                } else if (row.isRequestMasked()) {
                    // Coerente con cio' che il richiedente vede: la richiesta e' ancora "inviata".
                    throw new AppException(ErrorCode.FRIEND_REQUEST_ALREADY_SENT,
                            "Hai gia' inviato una richiesta a questo utente");
                } else {
                    // Rifiuto silenzioso: l'altro non viene avvisato, per chi chiede la richiesta riparte.
                    row.setRequestMasked(true);
                    row.setUpdatedAt(now);
                }
            }
            case REMOVED -> {
                if (!closedByMe) {
                    throw new AppException(ErrorCode.FRIENDSHIP_UNAVAILABLE, "L'amicizia non e' disponibile");
                }
                reopen(row, me, addressee, now);
            }
        }
        return FriendshipResponse.from(row, me);
    }

    /**
     * Accetta una richiesta ricevuta. Ordine dei controlli (decisione 63): non coinvolto 404, non destinatario 403,
     * non in attesa 409, richiedente non piu' attivo 409.
     */
    @Transactional
    public FriendshipResponse accept(UUID me, UUID friendshipId) {
        Friendship row = loadInvolved(friendshipId, me);
        requireAddressee(row, me);
        requirePending(row);
        if (userAccess.resolve(row.getRequester().getId()).status() != AccessStatus.ACTIVE) {
            throw new AppException(ErrorCode.USER_NOT_ACTIVE, "L'utente non e' piu' attivo");
        }
        Instant now = clock.instant();
        row.setStatus(FriendshipStatus.ACCEPTED);
        row.setUpdatedAt(now);
        // La richiesta gestita resta nell'elenco del destinatario, letta; chi l'aveva mandata viene avvisato (decisione 97).
        notifications.markRead(me, NotificationType.FRIEND_REQUEST, row.getId());
        notifications.create(row.getRequester(), row.getAddressee(), NotificationType.FRIEND_ACCEPTED, row.getId(), now);
        return FriendshipResponse.from(row, me);
    }

    /**
     * Rifiuta una richiesta ricevuta in silenzio (decisione 59): la riga diventa DECLINED chiusa dal destinatario
     * e "mascherata", cosi' il richiedente continua a vederla come inviata.
     */
    @Transactional
    public void decline(UUID me, UUID friendshipId) {
        Friendship row = loadInvolved(friendshipId, me);
        requireAddressee(row, me);
        requirePending(row);
        row.setStatus(FriendshipStatus.DECLINED);
        row.setClosedBy(me);
        row.setRequestMasked(true);
        row.setUpdatedAt(clock.instant());
        // Rifiuto silenzioso: solo la notifica del destinatario passa a letta, chi ha chiesto non riceve nulla.
        notifications.markRead(me, NotificationType.FRIEND_REQUEST, row.getId());
    }

    /**
     * Annulla una richiesta inviata. Una richiesta gia' rifiutata in silenzio si annulla solo per chi l'ha fatta:
     * per lui torna NONE (la maschera cade) e il rifiuto resta registrato.
     */
    @Transactional
    public void cancel(UUID me, UUID friendshipId) {
        Friendship row = loadInvolved(friendshipId, me);
        if (!row.getRequester().getId().equals(me)) {
            throw new AppException(ErrorCode.NOT_FRIENDSHIP_REQUESTER, "Solo chi ha inviato la richiesta puo' annullarla");
        }
        if (row.getStatus() == FriendshipStatus.PENDING) {
            row.setStatus(FriendshipStatus.CANCELLED);
            // La richiesta non esiste piu': sparisce anche la notifica del destinatario (decisione 97).
            notifications.delete(row.getAddressee().getId(), NotificationType.FRIEND_REQUEST, row.getId());
        } else if (row.getStatus() == FriendshipStatus.DECLINED && row.isRequestMasked()) {
            row.setRequestMasked(false);
        } else {
            throw notPending();
        }
        row.setUpdatedAt(clock.instant());
    }

    /**
     * Rimuove un'amicizia, per iniziativa di una delle due parti: chi rimuove potra' richiedere, l'altro vedra'
     * UNAVAILABLE. La conversazione resta leggibile (progettazione, sezione 6.14).
     */
    @Transactional
    public void remove(UUID me, UUID friendshipId) {
        Friendship row = loadInvolved(friendshipId, me);
        if (row.getStatus() != FriendshipStatus.ACCEPTED) {
            throw new AppException(ErrorCode.NOT_FRIENDS, "Non siete amici");
        }
        row.setStatus(FriendshipStatus.REMOVED);
        row.setClosedBy(me);
        row.setUpdatedAt(clock.instant());
    }

    /**
     * Elenco paginato delle amicizie di {@code me} per tipo, dalla piu' recente. Gli utenti sospesi restano negli
     * elenchi: non possono connettersi, ma l'amicizia esiste ancora (progettazione, sezione 6.14).
     */
    @Transactional(readOnly = true)
    public PageResponse<FriendshipResponse> list(UUID me, FriendshipListType type, PageParams params) {
        Pageable pageable = params.toPageable(Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id")));
        Page<Friendship> page = switch (type) {
            case FRIENDS -> friendships.findByStatusInvolving(me, FriendshipStatus.ACCEPTED, pageable);
            case INCOMING -> friendships.findByStatusReceivedBy(me, FriendshipStatus.PENDING, pageable);
            case OUTGOING -> friendships.findSentBy(me, FriendshipStatus.PENDING, FriendshipStatus.DECLINED, pageable);
        };
        return PageResponse.from(page.map(row -> FriendshipResponse.from(row, me)));
    }

    /**
     * Se i due utenti sono amici, in qualunque verso. Lo usa la chat (F5-02).
     */
    @Transactional(readOnly = true)
    public boolean areFriends(UUID a, UUID b) {
        return friendships.existsBetween(a, b, FriendshipStatus.ACCEPTED);
    }

    /**
     * La relazione di {@code me} con ognuno degli utenti indicati, con una sola query. La mappa ha una voce per ogni
     * id (chi chiede, se compare, viene ignorato). Un utente inesistente, non verificato o non attivo e'
     * {@code UNAVAILABLE}, salvo se e' gia' un amico (decisione 63); l'id della riga c'e' solo per OUTGOING,
     * INCOMING e FRIENDS. Lo usano la ricerca utenti (F4-05) e la chat (F5-02).
     */
    @Transactional(readOnly = true)
    public Map<UUID, FriendshipRelation> relationsFor(UUID me, Collection<UUID> otherIds) {
        Set<UUID> ids = new HashSet<>(otherIds);
        ids.remove(me);
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<UUID, FriendshipRelation> relations = new HashMap<>();
        for (FriendshipRepository.RelationRow found : friendships.findRelationRows(me, ids)) {
            relations.put(found.userId(), relationOf(found, me));
        }
        // Un id che non e' un utente non e' disponibile.
        for (UUID id : ids) {
            relations.putIfAbsent(id, FriendshipRelation.UNAVAILABLE);
        }
        return relations;
    }

    private FriendshipRelation relationOf(FriendshipRepository.RelationRow found, UUID me) {
        FriendshipView view = found.friendship() == null ? FriendshipView.NONE : found.friendship().viewFor(me);
        if (!found.available() && view != FriendshipView.FRIENDS) {
            return FriendshipRelation.UNAVAILABLE;
        }
        return switch (view) {
            case OUTGOING, INCOMING, FRIENDS -> new FriendshipRelation(view, found.friendship().getId());
            case NONE -> FriendshipRelation.NONE;
            case UNAVAILABLE -> FriendshipRelation.UNAVAILABLE;
        };
    }

    /**
     * La riga con lock, o 404 se non esiste o non riguarda {@code me}: un'amicizia altrui non si distingue da una
     * inesistente.
     */
    private Friendship loadInvolved(UUID friendshipId, UUID me) {
        return friendships.findForUpdateById(friendshipId)
                .filter(row -> row.getRequester().getId().equals(me) || row.getAddressee().getId().equals(me))
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Amicizia non trovata"));
    }

    private void requireAddressee(Friendship row, UUID me) {
        if (!row.getAddressee().getId().equals(me)) {
            throw new AppException(ErrorCode.NOT_FRIENDSHIP_ADDRESSEE,
                    "Solo chi ha ricevuto la richiesta puo' rispondere");
        }
    }

    private void requirePending(Friendship row) {
        if (row.getStatus() != FriendshipStatus.PENDING) {
            throw notPending();
        }
    }

    private AppException notPending() {
        return new AppException(ErrorCode.FRIEND_REQUEST_NOT_PENDING, "La richiesta non e' piu' in attesa");
    }

    /**
     * Riapre la riga: {@code me} diventa il richiedente, lo stato torna PENDING e chiusura e maschera si azzerano.
     */
    private void reopen(Friendship row, UUID me, User addressee, Instant now) {
        User requester = users.getReferenceById(me);
        row.setRequester(requester);
        row.setAddressee(addressee);
        row.setStatus(FriendshipStatus.PENDING);
        row.setClosedBy(null);
        row.setRequestMasked(false);
        row.setUpdatedAt(now);
        notifications.create(addressee, requester, NotificationType.FRIEND_REQUEST, row.getId(), now);
    }
}

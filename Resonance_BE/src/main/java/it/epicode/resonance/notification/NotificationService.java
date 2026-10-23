package it.epicode.resonance.notification;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.notification.dto.NotificationResponse;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.dto.AuthorSummary;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Notifiche salvate (decisione 97): crea la riga nella transazione del chiamante e pubblica la notifica live, che
 * parte dopo il commit (progettazione, sezione 7.6); chiude o cancella quelle di una richiesta gestita. Richiede
 * una transazione gia' aperta: salvataggio e azione che la causa riescono o falliscono insieme.
 */
@Service
public class NotificationService {

    /** Quanto resta una notifica salvata, dalla creazione. */
    private static final Duration RETENTION = Duration.ofDays(30);

    private final NotificationRepository notifications;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public NotificationService(NotificationRepository notifications, ApplicationEventPublisher events, Clock clock) {
        this.notifications = notifications;
        this.events = events;
        this.clock = clock;
    }

    /**
     * Salva una notifica non letta per {@code recipient} e la consegna live dopo il commit.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void create(User recipient, User actor, NotificationType type, UUID targetId, Instant createdAt) {
        Notification saved = notifications.save(new Notification(recipient, actor, type, targetId, createdAt));
        publishLive(saved.getId(), recipient, actor, type, targetId, createdAt);
    }

    /**
     * Come {@link #create} per un like, ma una sola volta per coppia autore-post, qualunque sia lo stato di lettura:
     * mettere, togliere e rimettere il like non rinnova la notifica. Se esisteva gia' non parte neppure la live.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void createLikeOnce(User recipient, User actor, UUID postId) {
        Instant now = clock.instant();
        UUID id = UUID.randomUUID();
        int inserted = notifications.insertLikeIfAbsent(id, recipient.getId(), actor.getId(), postId, now);
        if (inserted == 1) {
            publishLive(id, recipient, actor, NotificationType.NEW_LIKE, postId, now);
        }
    }

    /**
     * Segna lette le notifiche del destinatario per quel tipo e bersaglio (richiesta accettata o rifiutata).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void markRead(UUID recipientId, NotificationType type, UUID targetId) {
        notifications.markRead(recipientId, type, targetId, clock.instant());
    }

    /**
     * Cancella le notifiche del destinatario per quel tipo e bersaglio (richiesta annullata).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void delete(UUID recipientId, NotificationType type, UUID targetId) {
        notifications.deleteByTarget(recipientId, type, targetId);
    }

    /**
     * Pagina delle notifiche di {@code me}, dalla piu' recente; a parita' di istante decide l'id, cosi' le pagine non
     * hanno doppioni ne' buchi.
     */
    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> list(UUID me, PageParams params) {
        Sort sort = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
        return PageResponse.from(notifications.findByRecipientId(me, params.toPageable(sort))
                .map(NotificationResponse::from));
    }

    /**
     * Numero di notifiche non lette di {@code me}.
     */
    @Transactional(readOnly = true)
    public long unreadCount(UUID me) {
        return notifications.countByRecipientIdAndReadAtIsNull(me);
    }

    /**
     * Segna letta una notifica di {@code me}. Una notifica altrui o inesistente e' un 404; se era gia' letta
     * resta com'e' (idempotente) e conserva il primo orario di lettura.
     */
    @Transactional
    public void markRead(UUID me, UUID notificationId) {
        Notification notification = notifications.findByIdAndRecipientId(notificationId, me)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Notifica non trovata"));
        if (notification.getReadAt() == null) {
            notification.setReadAt(clock.instant());
        }
    }

    /**
     * Segna lette tutte le notifiche non lette di {@code me}.
     */
    @Transactional
    public void markAllRead(UUID me) {
        notifications.markAllRead(me, clock.instant());
    }

    /**
     * Cancella le notifiche create da piu' di 30 giorni, lette o no (decisione 97). Usa fixedDelay, che parte anche
     * all'avvio, perche' su Render il servizio gratuito si sospende (progettazione, sezione 4.11).
     */
    @Scheduled(fixedDelay = 24, timeUnit = TimeUnit.HOURS)
    @Transactional
    public void deleteExpired() {
        notifications.deleteCreatedBefore(clock.instant().minus(RETENTION));
    }

    private void publishLive(UUID id, User recipient, User actor, NotificationType type, UUID targetId,
                             Instant createdAt) {
        events.publishEvent(new LiveNotificationEvent(recipient.getId(),
                new LiveNotification(id, type, createdAt, AuthorSummary.from(actor), targetId, null)));
    }
}

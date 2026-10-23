package it.epicode.resonance.notification;

import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.notification.dto.NotificationResponse;
import it.epicode.resonance.notification.dto.UnreadCountResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Endpoint delle notifiche salvate (decisione 97): tutti richiedono il login e lavorano solo sulle notifiche del
 * chiamante; quelle altrui sono un 404 nel service.
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    /**
     * Elenco paginato delle notifiche del chiamante, dalla piu' recente.
     */
    @GetMapping
    public PageResponse<NotificationResponse> list(@AuthenticationPrincipal AuthenticatedUser user,
                                                   @Valid PageParams params) {
        return notificationService.list(user.id(), params);
    }

    /**
     * Quante notifiche non lette ha il chiamante.
     */
    @GetMapping("/unread-count")
    public UnreadCountResponse unreadCount(@AuthenticationPrincipal AuthenticatedUser user) {
        return new UnreadCountResponse(notificationService.unreadCount(user.id()));
    }

    /**
     * Segna letta una notifica del chiamante: 204, anche se era gia' letta.
     */
    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        notificationService.markRead(user.id(), id);
    }

    /**
     * Segna lette tutte le notifiche non lette del chiamante.
     */
    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead(@AuthenticationPrincipal AuthenticatedUser user) {
        notificationService.markAllRead(user.id());
    }
}

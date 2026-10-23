package it.epicode.resonance.event;

import it.epicode.resonance.chat.ChatConversation;
import it.epicode.resonance.chat.ChatMessage;
import it.epicode.resonance.chat.ChatService;
import it.epicode.resonance.chat.ChatUnlockSource;
import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.RateLimit;
import it.epicode.resonance.common.RateLimitService;
import it.epicode.resonance.event.dto.ContactResponse;
import it.epicode.resonance.notification.LiveNotification;
import it.epicode.resonance.notification.LiveNotificationEvent;
import it.epicode.resonance.notification.NotificationType;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.dto.AuthorSummary;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * Contatto dell'organizzatore di un evento (progettazione, sezioni 6.6 e 6.9; decisione 69): la parte comune a
 * concerti e indie event, cosi' le regole sono scritte una volta sola. I service degli eventi controllano prima
 * che l'evento sia visibile e l'organizzatore attivo (404) e poi chiamano {@link #contact}.
 */
@Service
public class EventContactService {

    private final ChatService chat;
    private final RateLimitService rateLimits;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public EventContactService(ChatService chat, RateLimitService rateLimits, ApplicationEventPublisher events,
                               Clock clock) {
        this.chat = chat;
        this.rateLimits = rateLimits;
        this.events = events;
        this.clock = clock;
    }

    /**
     * L'evento da contattare: origine dello sblocco, titolo, organizzatore e data di inizio.
     */
    record Target(ChatUnlockSource source, UUID eventId, String title, User organizer, Instant eventDate) {
    }

    /**
     * Contatta l'organizzatore, con i controlli nell'ordine di sezione 6.6: evento gia' iniziato (409
     * {@code EVENT_CLOSED}), organizzatore uguale al chiamante (400 {@code CANNOT_CONTACT_OWN_EVENT}) e solo alla
     * fine il limite {@code EVENT_CONTACTS}, cosi' i rifiuti non lo consumano. Poi, nella stessa transazione:
     * conversazione senza controllo di amicizia, sblocco dell'evento (una sola riga anche con piu' contatti) e
     * messaggio con il titolo. Dopo il commit arrivano il messaggio a entrambi e {@code NEW_MESSAGE}
     * all'organizzatore: a differenza della candidatura, il contatto non ha un tipo di notifica suo.
     */
    @Transactional
    public ContactResponse contact(Target target, UUID callerId, String message) {
        User organizer = target.organizer();
        // L'evento e' aperto fino all'istante di inizio escluso: lo sblocco di canSend usa lo stesso confronto.
        if (!target.eventDate().isAfter(clock.instant())) {
            throw new AppException(ErrorCode.EVENT_CLOSED, "L'evento e' gia' iniziato");
        }
        if (organizer.getId().equals(callerId)) {
            throw new AppException(ErrorCode.CANNOT_CONTACT_OWN_EVENT,
                    "Non puoi contattare l'organizzatore del tuo evento");
        }
        rateLimits.consume(RateLimit.EVENT_CONTACTS, callerId.toString());

        ChatMessage saved = chat.sendUnlockedMessage(callerId, organizer.getId(), target.source(), target.eventId(),
                "Contatto per «" + target.title() + "»:\n" + message);
        ChatConversation conversation = saved.getConversation();
        User caller = conversation.otherThan(organizer.getId());
        events.publishEvent(new LiveNotificationEvent(organizer.getId(), new LiveNotification(
                null, NotificationType.NEW_MESSAGE, saved.getSentAt(), AuthorSummary.from(caller), conversation.getId(),
                ChatService.preview(saved.getBody()))));
        return new ContactResponse(conversation.getId(), saved.getId());
    }
}

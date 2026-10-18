package it.epicode.resonance.chat;

import it.epicode.resonance.auth.AccessStatus;
import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.auth.UserAccess;
import it.epicode.resonance.auth.UserAccessService;
import it.epicode.resonance.chat.dto.ChatMessageResponse;
import it.epicode.resonance.chat.dto.ConversationResponse;
import it.epicode.resonance.chat.dto.MessagePageResponse;
import it.epicode.resonance.chat.dto.SendMessageRequest;
import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.common.RateLimit;
import it.epicode.resonance.common.RateLimitService;
import it.epicode.resonance.friendship.FriendshipRelation;
import it.epicode.resonance.friendship.FriendshipService;
import it.epicode.resonance.friendship.FriendshipView;
import it.epicode.resonance.notification.LiveNotification;
import it.epicode.resonance.notification.LiveNotificationEvent;
import it.epicode.resonance.notification.NotificationType;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserStatus;
import it.epicode.resonance.user.dto.AuthorSummary;
import jakarta.validation.Validator;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Limit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Chat privata (progettazione, sezioni 6.9 e 7.5; decisione 59): conversazioni, permesso di scrittura (amici o
 * sblocco aperto), storico a cursore, lettura e invio dei messaggi.
 */
@Service
public class ChatService {

    private static final int PREVIEW_LENGTH = 100;
    private static final String TOKEN_MESSAGE = "Token mancante, scaduto o non valido";

    private final ChatConversationRepository conversations;
    private final ChatMessageRepository messages;
    private final ChatUnlockRepository unlocks;
    private final UserRepository users;
    private final UserAccessService userAccess;
    private final FriendshipService friendships;
    private final RateLimitService rateLimits;
    private final Validator validator;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public ChatService(ChatConversationRepository conversations, ChatMessageRepository messages,
                       ChatUnlockRepository unlocks, UserRepository users, UserAccessService userAccess,
                       FriendshipService friendships, RateLimitService rateLimits, Validator validator,
                       ApplicationEventPublisher events, Clock clock) {
        this.conversations = conversations;
        this.messages = messages;
        this.unlocks = unlocks;
        this.users = users;
        this.userAccess = userAccess;
        this.friendships = friendships;
        this.rateLimits = rateLimits;
        this.validator = validator;
        this.events = events;
        this.clock = clock;
    }

    // ---- conversazioni ----

    /**
     * Trova o crea la conversazione con {@code recipientId}, nell'ordine deciso per la card (decisione 66): se
     * stessi 400; una conversazione gia' esistente si restituisce sempre, anche se l'altro e' stato sospeso o
     * l'amicizia rimossa (lo storico resta leggibile) e senza toccare il limite; per una nuova, destinatario non
     * attivo 404, non amici 403 {@code NOT_FRIENDS} e solo alla fine il limite {@code CONVERSATIONS_CREATED}, cosi'
     * i rifiuti non consumano le creazioni.
     */
    @Transactional
    public ConversationResponse findOrCreate(UUID me, UUID recipientId) {
        if (me.equals(recipientId)) {
            throw new AppException(ErrorCode.CANNOT_MESSAGE_SELF, "Non puoi scrivere a te stesso");
        }
        UUID low = lower(me, recipientId);
        UUID high = higher(me, recipientId);
        ChatConversation conversation = conversations.findByPair(low, high).orElse(null);
        if (conversation == null) {
            // Un destinatario inesistente, non verificato o sospeso non esiste per gli altri.
            if (userAccess.resolve(recipientId).status() != AccessStatus.ACTIVE) {
                throw new AppException(ErrorCode.NOT_FOUND, "Utente non trovato");
            }
            if (!friendships.areFriends(me, recipientId)) {
                throw new AppException(ErrorCode.NOT_FRIENDS, "Puoi iniziare una conversazione solo con i tuoi amici");
            }
            rateLimits.consume(RateLimit.CONVERSATIONS_CREATED, me.toString());
            conversation = insertAndLoad(low, high);
        }
        return toResponses(me, List.of(conversation)).get(0);
    }

    /**
     * Trova o crea la conversazione fra due utenti senza controllare l'amicizia e senza il limite
     * {@code CONVERSATIONS_CREATED}: la usano candidature e contatti, che hanno i propri limiti (progettazione,
     * sezione 6.9). Il chiamante ha gia' verificato che i due utenti siano attivi.
     */
    @Transactional
    public ChatConversation findOrCreateConversation(UUID a, UUID b) {
        UUID low = lower(a, b);
        UUID high = higher(a, b);
        return conversations.findByPair(low, high).orElseGet(() -> insertAndLoad(low, high));
    }

    /**
     * Le conversazioni di {@code me}, dall'ultima attivita', con ultimo messaggio, non letti e {@code canSend}
     * calcolati per l'intera pagina con poche query.
     */
    @Transactional(readOnly = true)
    public PageResponse<ConversationResponse> list(UUID me, PageParams params) {
        // L'ordine sta nella query (nulli in fondo): nessun sort dal Pageable.
        Page<ChatConversation> page = conversations.findForMember(me, params.toPageable(Sort.unsorted()));
        List<ConversationResponse> content = toResponses(me, page.getContent());
        return new PageResponse<>(content, page.getNumber(), page.getSize(), page.getTotalElements(),
                page.getTotalPages());
    }

    // ---- permesso di scrittura ----

    /**
     * Se in questa conversazione si puo' scrivere: i due membri sono attivi e (sono amici oppure c'e' uno
     * sblocco con l'origine aperta). Un membro sospeso blocca la scrittura senza dire perche' (decisione 66).
     */
    @Transactional
    public boolean canSend(ChatConversation conversation) {
        UUID a = conversation.getUserA().getId();
        UUID b = conversation.getUserB().getId();
        boolean allowed = friendships.areFriends(a, b)
                || unlocks.hasOpenUnlock(conversation.getId(), clock.instant());
        return allowed && userAccess.resolve(a).isActive() && userAccess.resolve(b).isActive();
    }

    /**
     * Registra uno sblocco: scrivere resta possibile finche' l'origine e' aperta. Una seconda volta dalla stessa
     * origine non crea un'altra riga. Il chiamante ha letto l'origine nella stessa transazione (non c'e' FK).
     */
    @Transactional
    public void unlock(ChatConversation conversation, ChatUnlockSource source, UUID sourceId) {
        unlocks.insertIfAbsent(conversation.getId(), source.name(), sourceId);
    }

    // ---- storico e lettura ----

    /**
     * Una pagina dello storico, dal messaggio piu' recente. Non dipende dal permesso di scrittura: lo storico resta
     * leggibile anche dopo la rimozione dell'amicizia.
     */
    @Transactional(readOnly = true)
    public MessagePageResponse messages(UUID me, UUID conversationId, UUID before, int size) {
        loadAsMember(conversationId, me);
        if (before != null && !messages.existsByIdAndConversationId(before, conversationId)) {
            throw new AppException(ErrorCode.NOT_FOUND, "Messaggio non trovato in questa conversazione");
        }
        // Uno in piu' del richiesto: se arriva, ci sono messaggi piu' vecchi.
        Limit limit = Limit.of(size + 1);
        List<ChatMessage> found = before == null
                ? messages.findLatest(conversationId, limit)
                : messages.findBefore(conversationId, before, limit);
        boolean hasMore = found.size() > size;
        return new MessagePageResponse(
                found.stream().limit(size).map(ChatMessageResponse::from).toList(), hasMore);
    }

    /**
     * Segna come letti i messaggi dell'altro membro; i propri restano com'erano.
     */
    @Transactional
    public void markRead(UUID me, UUID conversationId) {
        loadAsMember(conversationId, me);
        messages.markReadFor(conversationId, me, clock.instant());
    }

    // ---- invio ----

    /**
     * Invia un messaggio dal WebSocket, con i controlli nell'ordine di progettazione, sezione 7.5: token, limite,
     * body, conversazione e appartenenza, permesso di scrittura. La connessione resta aperta anche dopo la
     * sospensione o la scadenza del token, quindi i controlli si ripetono a ogni invio. Il messaggio arriva ai due
     * membri solo dopo il commit ({@link ChatMessageListener}).
     */
    @Transactional
    public void send(UUID conversationId, SendMessageRequest request, AuthenticatedUser user) {
        requireValidToken(user);
        rateLimits.consume(RateLimit.CHAT_MESSAGES, user.id().toString());
        if (request == null || !validator.validate(request).isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Uno o piu' campi non sono validi");
        }
        ChatConversation conversation = loadAsMember(conversationId, user.id());
        if (!canSend(conversation)) {
            throw new AppException(ErrorCode.CHAT_LOCKED, "Al momento non puoi inviare messaggi a questo utente");
        }
        ChatMessage message = appendMessage(conversation, user.id(), request.body());
        User recipient = conversation.otherThan(user.id());
        events.publishEvent(new ChatMessageEvent(user.id(), recipient.getId(), ChatMessageResponse.from(message)));
        events.publishEvent(new LiveNotificationEvent(recipient.getId(), new LiveNotification(
                NotificationType.NEW_MESSAGE, message.getSentAt(), AuthorSummary.from(conversation.otherThan(recipient.getId())),
                conversation.getId(), preview(message.getBody()))));
    }

    /**
     * Salva il messaggio e aggiorna {@code last_message_at} della conversazione. Non controlla il permesso: lo fa
     * {@link #send}.
     */
    @Transactional
    public ChatMessage appendMessage(ChatConversation conversation, UUID senderId, String body) {
        Instant now = clock.instant();
        ChatMessage message = messages.save(
                new ChatMessage(conversation, users.getReferenceById(senderId), body, now));
        conversation.setLastMessageAt(now);
        return message;
    }

    /**
     * Parte finale comune di candidatura e contatto: trova o crea la conversazione senza controllo di amicizia,
     * registra lo sblocco, salva il messaggio e pubblica {@link ChatMessageEvent} per i due utenti, che arriva dopo
     * il commit. I controlli, il limite di frequenza e la notifica restano nel chiamante (ottimizzazione O3,
     * decisione 75). Il chiamante ha gia' verificato che i due utenti siano attivi.
     */
    @Transactional
    public ChatMessage sendUnlockedMessage(UUID senderId, UUID recipientId, ChatUnlockSource source, UUID sourceId,
                                           String body) {
        ChatConversation conversation = findOrCreateConversation(senderId, recipientId);
        unlock(conversation, source, sourceId);
        ChatMessage saved = appendMessage(conversation, senderId, body);
        events.publishEvent(new ChatMessageEvent(senderId, recipientId, ChatMessageResponse.from(saved)));
        return saved;
    }

    // ---- interni ----

    /**
     * I primi {@value #PREVIEW_LENGTH} caratteri del messaggio (progettazione, sezione 7.4), contati per punti di
     * codice cosi' una emoji non viene spezzata a meta'. Pubblico perche' lo usa anche il contatto degli eventi.
     */
    public static String preview(String body) {
        if (body.codePointCount(0, body.length()) <= PREVIEW_LENGTH) {
            return body;
        }
        return body.substring(0, body.offsetByCodePoints(0, PREVIEW_LENGTH));
    }

    /**
     * Token ancora valido: scadenza nel futuro e utente ancora attivo nel database (progettazione, sezione 7.7).
     */
    private void requireValidToken(AuthenticatedUser user) {
        if (!user.accessTokenExpiresAt().isAfter(clock.instant())) {
            throw new AppException(ErrorCode.TOKEN_INVALID, TOKEN_MESSAGE);
        }
        UserAccess access = userAccess.resolve(user.id());
        if (access.status() == AccessStatus.SUSPENDED) {
            throw new AppException(ErrorCode.ACCOUNT_SUSPENDED, "Account sospeso");
        }
        if (!access.isActive()) {
            throw new AppException(ErrorCode.TOKEN_INVALID, TOKEN_MESSAGE);
        }
    }

    /**
     * La conversazione, o 404 se non esiste e 403 {@code NOT_CONVERSATION_MEMBER} se {@code me} non e' uno dei due
     * membri (progettazione, sezione 6.9).
     */
    private ChatConversation loadAsMember(UUID conversationId, UUID me) {
        ChatConversation conversation = conversations.findWithUsersById(conversationId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Conversazione non trovata"));
        if (!conversation.hasMember(me)) {
            throw new AppException(ErrorCode.NOT_CONVERSATION_MEMBER, "Non fai parte di questa conversazione");
        }
        return conversation;
    }

    /**
     * Crea la riga della coppia se manca e la rilegge: due creazioni concorrenti danno la stessa conversazione
     * ({@code ON CONFLICT DO NOTHING} sulla coppia canonica).
     */
    private ChatConversation insertAndLoad(UUID low, UUID high) {
        conversations.insertIfAbsent(low, high);
        return conversations.findByPair(low, high).orElseThrow();
    }

    /**
     * Le risposte per una pagina di conversazioni di {@code me}: ultimo messaggio, non letti e permesso di
     * scrittura con una query ciascuno per l'intera pagina, non una per riga.
     */
    private List<ConversationResponse> toResponses(UUID me, List<ChatConversation> page) {
        if (page.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = page.stream().map(ChatConversation::getId).toList();
        Map<UUID, ChatMessage> last = messages.findLastOfEach(ids).stream()
                .collect(Collectors.toMap(m -> m.getConversation().getId(), Function.identity()));
        Map<UUID, Long> unread = messages.countUnread(ids, me).stream()
                .collect(Collectors.toMap(ChatMessageRepository.UnreadCount::conversationId,
                        ChatMessageRepository.UnreadCount::count));
        Set<UUID> sendable = sendableIds(me, page);
        return page.stream().map(conversation -> {
            ChatMessage lastMessage = last.get(conversation.getId());
            return new ConversationResponse(conversation.getId(),
                    AuthorSummary.from(conversation.otherThan(me)),
                    lastMessage == null ? null : ConversationResponse.LastMessage.from(lastMessage),
                    unread.getOrDefault(conversation.getId(), 0L),
                    conversation.getLastMessageAt(),
                    sendable.contains(conversation.getId()));
        }).toList();
    }

    /**
     * Le conversazioni della pagina in cui si puo' scrivere: l'altro membro e' attivo e (e' un amico oppure ha uno
     * sblocco aperto). Due query per la pagina: le amicizie con tutti gli altri membri e gli sblocchi per gli id
     * delle conversazioni. Chi chiede e' attivo per definizione.
     */
    private Set<UUID> sendableIds(UUID me, List<ChatConversation> page) {
        Instant now = clock.instant();
        Set<UUID> otherIds = page.stream().map(c -> c.otherThan(me).getId()).collect(Collectors.toSet());
        Map<UUID, FriendshipRelation> relations = friendships.relationsFor(me, otherIds);
        List<UUID> notFriends = page.stream()
                .filter(c -> relations.get(c.otherThan(me).getId()).status() != FriendshipView.FRIENDS)
                .map(ChatConversation::getId)
                .toList();
        Set<UUID> unlocked = notFriends.isEmpty()
                ? Set.of() : new HashSet<>(unlocks.findConversationIdsWithOpenUnlock(notFriends, now));
        Set<UUID> sendable = new HashSet<>();
        for (ChatConversation conversation : page) {
            User other = conversation.otherThan(me);
            boolean allowed = relations.get(other.getId()).status() == FriendshipView.FRIENDS
                    || unlocked.contains(conversation.getId());
            if (allowed && isActive(other, now)) {
                sendable.add(conversation.getId());
            }
        }
        return sendable;
    }

    /**
     * Utente attivo all'istante {@code now}: una sospensione scaduta conta come attivo, come nella riattivazione
     * pigra di {@code UserAccessService}.
     */
    private static boolean isActive(User user, Instant now) {
        return user.isEmailVerified() && (user.getStatus() == UserStatus.ACTIVE
                || (user.getSuspendedUntil() != null && !user.getSuspendedUntil().isAfter(now)));
    }

    // Ordine canonico della coppia (ck_chat_conversations_order). Si confrontano le stringhe e non
    // UUID.compareTo, che e' con segno e dissente dal confronto byte per byte di PostgreSQL; l'esadecimale
    // minuscolo a larghezza fissa ordina come i byte senza segno.
    private static UUID lower(UUID a, UUID b) {
        return a.toString().compareTo(b.toString()) < 0 ? a : b;
    }

    private static UUID higher(UUID a, UUID b) {
        return a.toString().compareTo(b.toString()) < 0 ? b : a;
    }
}

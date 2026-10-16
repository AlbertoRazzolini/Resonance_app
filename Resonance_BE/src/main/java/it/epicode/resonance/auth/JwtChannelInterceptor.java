package it.epicode.resonance.auth;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.WsError;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.Optional;
import java.util.Set;

/**
 * Sicurezza del WebSocket sui frame in arrivo dal client (progettazione, sezioni 7.2 e 7.3). CONNECT:
 * token nell'header Authorization e utente attivo letto dal database; il Principal della sessione e'
 * l'{@link AuthenticatedUser}. SEND solo verso /app/**, SUBSCRIBE solo verso le tre code dell'utente:
 * senza queste regole un client potrebbe fare SEND a /user/{id}/queue/... e recapitare messaggi falsi.
 * I messaggi d'errore sono generici: non rivelano lo stato dell'account ne' le destinazioni richieste.
 */
@Component
public class JwtChannelInterceptor implements ChannelInterceptor {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final String APP_PREFIX = "/app/";
    private static final Set<String> USER_QUEUES = Set.of(
            "/user/queue/messages", "/user/queue/notifications", "/user/queue/errors");

    private static final String TOKEN_MESSAGE = "Token mancante, scaduto o non valido";

    private final AccessTokenService accessTokens;
    private final UserAccessService userAccess;
    // Lazy: il template nasce dalla stessa configurazione che registra questo interceptor.
    private final ObjectProvider<SimpMessagingTemplate> messagingTemplate;

    public JwtChannelInterceptor(AccessTokenService accessTokens, UserAccessService userAccess,
                                 ObjectProvider<SimpMessagingTemplate> messagingTemplate) {
        this.accessTokens = accessTokens;
        this.userAccess = userAccess;
        this.messagingTemplate = messagingTemplate;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }
        return switch (accessor.getCommand()) {
            case CONNECT, STOMP -> {
                accessor.setUser(authenticate(accessor));
                yield message;
            }
            case SEND -> {
                String destination = accessor.getDestination();
                yield filter(message, accessor, destination != null && destination.startsWith(APP_PREFIX));
            }
            case SUBSCRIBE -> filter(message, accessor, USER_QUEUES.contains(accessor.getDestination()));
            default -> message;
        };
    }

    /**
     * Verifica il token e lo stato dell'utente. Un'eccezione diventa un frame ERROR e la connessione viene
     * chiusa (sezione 7.2). Solo un utente sospeso con token valido riceve ACCOUNT_SUSPENDED; email non
     * verificata e utente inesistente sono indistinguibili da un token non valido (decisione 65).
     */
    private AuthenticatedUser authenticate(StompHeaderAccessor accessor) {
        AccessTokenClaims claims = Optional.ofNullable(accessor.getFirstNativeHeader(HttpHeaders.AUTHORIZATION))
                .filter(header -> header.startsWith(BEARER_PREFIX))
                .flatMap(header -> accessTokens.parse(header.substring(BEARER_PREFIX.length()).strip()))
                .orElseThrow(() -> new AppException(ErrorCode.TOKEN_INVALID, TOKEN_MESSAGE));
        UserAccess access = userAccess.resolve(claims.userId());
        if (access.status() == AccessStatus.SUSPENDED) {
            throw new AppException(ErrorCode.ACCOUNT_SUSPENDED, "Account sospeso");
        }
        if (!access.isActive()) {
            throw new AppException(ErrorCode.TOKEN_INVALID, TOKEN_MESSAGE);
        }
        return new AuthenticatedUser(access.userId(), access.roles(), claims.expiresAt());
    }

    /**
     * Destinazione non ammessa: il frame viene scartato (null) e ACCESS_DENIED va su /user/queue/errors
     * della sola sessione che l'ha mandato, senza chiudere la connessione (sezione 7.3).
     */
    private Message<?> filter(Message<?> message, StompHeaderAccessor accessor, boolean allowed) {
        Principal user = accessor.getUser();
        if (user == null) {
            // SEND o SUBSCRIBE senza un CONNECT valido.
            throw new AppException(ErrorCode.TOKEN_INVALID, TOKEN_MESSAGE);
        }
        if (allowed) {
            return message;
        }
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        headers.setSessionId(accessor.getSessionId());
        headers.setLeaveMutable(true);
        messagingTemplate.getObject().convertAndSendToUser(user.getName(), WsError.QUEUE,
                WsError.of(ErrorCode.ACCESS_DENIED, "Operazione non consentita"), headers.getMessageHeaders());
        return null;
    }
}

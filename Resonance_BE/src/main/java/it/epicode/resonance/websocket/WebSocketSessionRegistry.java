package it.epicode.resonance.websocket;

import it.epicode.resonance.auth.AuthenticatedUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sessioni WebSocket aperte, per id di sessione e per utente (progettazione, sezione 7.8). Spring non
 * permette di chiudere dall'esterno la sessione di un utente: il decorator dell'handler (registrato in
 * WebSocketConfig) conserva la WebSocketSession, gli eventi di connessione e disconnessione dicono a
 * quale utente appartiene.
 */
@Component
public class WebSocketSessionRegistry {

    private static final Logger log = LoggerFactory.getLogger(WebSocketSessionRegistry.class);

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, UUID> userBySession = new ConcurrentHashMap<>();
    private final Map<UUID, Set<String>> sessionsByUser = new ConcurrentHashMap<>();

    /** Conserva la sessione appena aperta, ancora senza utente: l'utente arriva con CONNECTED. */
    public void register(WebSocketSession session) {
        sessions.put(session.getId(), session);
    }

    /** Dimentica la sessione, chiusa dal client o dal server. */
    public void unregister(String sessionId) {
        sessions.remove(sessionId);
        UUID userId = userBySession.remove(sessionId);
        if (userId != null) {
            sessionsByUser.computeIfPresent(userId, (id, ids) -> {
                ids.remove(sessionId);
                return ids.isEmpty() ? null : ids;
            });
        }
    }

    /** CONNECT riuscito: associa la sessione all'utente autenticato. */
    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        if (event.getUser() instanceof AuthenticatedUser user) {
            String sessionId = StompHeaderAccessor.wrap(event.getMessage()).getSessionId();
            userBySession.put(sessionId, user.id());
            sessionsByUser.computeIfAbsent(user.id(), id -> ConcurrentHashMap.newKeySet()).add(sessionId);
        }
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        unregister(event.getSessionId());
    }

    /** Numero di sessioni aperte dell'utente. */
    public int sessionCount(UUID userId) {
        return sessionsByUser.getOrDefault(userId, Set.of()).size();
    }

    /**
     * Chiude tutte le sessioni dell'utente con POLICY_VIOLATION. Una chiusura fallita non ferma le altre:
     * la sessione resta comunque protetta dai controlli a ogni SEND (sezione 7.8).
     */
    public void closeAll(UUID userId) {
        for (String sessionId : Set.copyOf(sessionsByUser.getOrDefault(userId, Set.of()))) {
            WebSocketSession session = sessions.get(sessionId);
            if (session == null) {
                continue;
            }
            try {
                session.close(CloseStatus.POLICY_VIOLATION);
            } catch (IOException e) {
                log.warn("Chiusura della sessione WebSocket {} non riuscita", sessionId, e);
            }
        }
    }
}

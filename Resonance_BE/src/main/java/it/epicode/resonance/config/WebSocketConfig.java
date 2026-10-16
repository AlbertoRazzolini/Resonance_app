package it.epicode.resonance.config;

import it.epicode.resonance.auth.JwtChannelInterceptor;
import it.epicode.resonance.common.StompErrorHandler;
import it.epicode.resonance.websocket.WebSocketSessionRegistry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;

/**
 * STOMP su WebSocket nativo, senza SockJS (progettazione, sezione 7.1). Il frontend manda SEND su /app/...
 * e riceve sulle code dell'utente /user/queue/...
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final String[] allowedOrigins;
    private final JwtChannelInterceptor jwtChannelInterceptor;
    private final StompErrorHandler stompErrorHandler;
    private final WebSocketSessionRegistry sessionRegistry;

    public WebSocketConfig(@Value("${app.cors.allowed-origins}") String[] allowedOrigins,
                           JwtChannelInterceptor jwtChannelInterceptor, StompErrorHandler stompErrorHandler,
                           WebSocketSessionRegistry sessionRegistry) {
        this.allowedOrigins = allowedOrigins;
        this.jwtChannelInterceptor = jwtChannelInterceptor;
        this.stompErrorHandler = stompErrorHandler;
        this.sessionRegistry = sessionRegistry;
    }

    /**
     * Il CorsConfig di MVC non vale per l'handshake: le origini vanno ripetute qui. La stessa origine e'
     * sempre ammessa; con la lista vuota (produzione) non lo e' nessun'altra.
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns(allowedOrigins);
        registry.setErrorHandler(stompErrorHandler);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(jwtChannelInterceptor);
    }

    /**
     * Decorator dell'handler WebSocket: conserva ogni sessione aperta nel registro, che serve a chiuderle
     * quando l'utente viene sospeso (sezione 7.8).
     */
    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.addDecoratorFactory(handler -> new WebSocketHandlerDecorator(handler) {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                sessionRegistry.register(session);
                super.afterConnectionEstablished(session);
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus)
                    throws Exception {
                sessionRegistry.unregister(session.getId());
                super.afterConnectionClosed(session, closeStatus);
            }
        });
    }
}

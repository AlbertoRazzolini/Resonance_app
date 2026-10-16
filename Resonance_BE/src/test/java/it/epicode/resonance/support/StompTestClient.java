package it.epicode.resonance.support;

import org.springframework.messaging.converter.JacksonJsonMessageConverter;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Client STOMP per i test di integrazione sul server avviato su una porta casuale (progettazione,
 * sezione 7.10): apre le connessioni, raccoglie i frame ERROR e i messaggi ricevuti in code bloccanti
 * e chiude tutto a fine test.
 */
public class StompTestClient implements AutoCloseable {

    /** Attesa massima di ogni operazione asincrona. */
    public static final long WAIT_SECONDS = 5;

    private final WebSocketStompClient client;
    private final String url;
    private final SimpMessagingTemplate template;
    private final List<Connection> connections = new ArrayList<>();

    public StompTestClient(int port, SimpMessagingTemplate template) {
        this.client = new WebSocketStompClient(new StandardWebSocketClient());
        this.client.setMessageConverter(new JacksonJsonMessageConverter());
        this.url = "ws://localhost:" + port + "/ws";
        this.template = template;
    }

    /**
     * Apre una connessione STOMP, con l'header Authorization solo se il token non e' nullo. Ritorna
     * appena la sessione e' connessa oppure e' arrivato un frame ERROR (CONNECT rifiutato).
     */
    public Connection connect(String token) throws Exception {
        StompHeaders headers = new StompHeaders();
        if (token != null) {
            headers.add("Authorization", "Bearer " + token);
        }
        Connection connection = new Connection(template);
        connections.add(connection);
        CompletableFuture<StompSession> future =
                client.connectAsync(url, new WebSocketHttpHeaders(), headers, connection.handler);
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(WAIT_SECONDS);
        while (!future.isDone() && connection.errorFrames.isEmpty() && System.nanoTime() < deadline) {
            Thread.sleep(20);
        }
        if (future.isDone() && !future.isCompletedExceptionally()) {
            connection.session = future.get();
        }
        return connection;
    }

    /**
     * Apre un WebSocket senza il client STOMP, manda il testo cosi' com'e' (per i frame che il client
     * STOMP non produrrebbe, come un SEND prima del CONNECT) e ritorna il primo testo ricevuto.
     */
    public String rawExchange(String frame) throws Exception {
        BlockingQueue<String> received = new LinkedBlockingQueue<>();
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.setSecWebSocketProtocol("v12.stomp");
        WebSocketSession session = new StandardWebSocketClient().execute(new TextWebSocketHandler() {
            @Override
            protected void handleTextMessage(WebSocketSession session, TextMessage message) {
                received.add(message.getPayload());
            }
        }, headers, URI.create(url)).get(WAIT_SECONDS, TimeUnit.SECONDS);
        try {
            session.sendMessage(new TextMessage(frame));
            return received.poll(WAIT_SECONDS, TimeUnit.SECONDS);
        } finally {
            session.close(CloseStatus.NORMAL);
        }
    }

    @Override
    public void close() {
        connections.forEach(connection -> {
            if (connection.isConnected()) {
                connection.session.disconnect();
            }
        });
        client.stop();
    }

    /** Frame ERROR ricevuto dal server: header "message" (il codice) e corpo JSON. */
    public record Frame(String message, Map<String, Object> body) {
    }

    /** Una connessione STOMP con le code dei frame ERROR e dei messaggi ricevuti. */
    public static class Connection {

        private final SimpMessagingTemplate template;
        private final BlockingQueue<Frame> errorFrames = new LinkedBlockingQueue<>();
        private final StompSessionHandlerAdapter handler = new StompSessionHandlerAdapter() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return Map.class;
            }

            @Override
            @SuppressWarnings("unchecked")
            public void handleFrame(StompHeaders headers, Object payload) {
                errorFrames.add(new Frame(headers.getFirst("message"), (Map<String, Object>) payload));
            }
        };
        private volatile StompSession session;

        private Connection(SimpMessagingTemplate template) {
            this.template = template;
        }

        public boolean isConnected() {
            return session != null && session.isConnected();
        }

        /** Aspetta il frame ERROR del server; null se non arriva entro il tempo massimo. */
        public Frame awaitErrorFrame() throws InterruptedException {
            return errorFrames.poll(WAIT_SECONDS, TimeUnit.SECONDS);
        }

        /** Aspetta che la connessione venga chiusa dal server. */
        public boolean awaitClosed() throws InterruptedException {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(WAIT_SECONDS);
            while (isConnected() && System.nanoTime() < deadline) {
                Thread.sleep(20);
            }
            return !isConnected();
        }

        /**
         * SUBSCRIBE a una coda dell'utente e attesa che sia attiva: la SUBSCRIBE e' asincrona, quindi
         * il server manda messaggi di controllo finche' il primo non arriva. Ritorna la coda dei
         * messaggi, gia' svuotata.
         */
        public BlockingQueue<Map<String, Object>> subscribe(String destination, UUID userId)
                throws InterruptedException {
            BlockingQueue<Map<String, Object>> received = new LinkedBlockingQueue<>();
            session.subscribe(destination, frameHandler(received));
            String queue = destination.substring("/user".length());
            Instant limit = Instant.now().plusSeconds(WAIT_SECONDS);
            while (received.isEmpty() && Instant.now().isBefore(limit)) {
                template.convertAndSendToUser(userId.toString(), queue, Map.of("controllo", 1));
                Thread.sleep(100);
            }
            if (received.isEmpty()) {
                throw new AssertionError("Iscrizione a " + destination + " non attiva");
            }
            Thread.sleep(200);
            received.clear();
            return received;
        }

        /** SUBSCRIBE senza attendere nulla: per le destinazioni che il server deve rifiutare. */
        public void subscribeWithoutWaiting(String destination) {
            session.subscribe(destination, frameHandler(new LinkedBlockingQueue<>()));
        }

        public void send(String destination, Object payload) {
            session.send(destination, payload);
        }

        private StompFrameHandler frameHandler(BlockingQueue<Map<String, Object>> received) {
            return new StompFrameHandler() {
                @Override
                public Type getPayloadType(StompHeaders headers) {
                    return Map.class;
                }

                @Override
                @SuppressWarnings("unchecked")
                public void handleFrame(StompHeaders headers, Object payload) {
                    received.add((Map<String, Object>) payload);
                }
            };
        }
    }
}

package it.epicode.resonance.event;

import it.epicode.resonance.chat.ChatConversation;
import it.epicode.resonance.chat.ChatTestSupport;
import it.epicode.resonance.support.StompTestClient;
import it.epicode.resonance.support.StompTestClient.Connection;
import it.epicode.resonance.user.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Contatto dell'organizzatore di un concerto o di un indie event (progettazione, sezioni 6.6 e 6.9; decisione 59):
 * controlli e codici d'errore nell'ordine previsto, messaggio in chat e NEW_MESSAGE dopo il commit, sblocco che
 * permette a due non amici di scriversi fino all'inizio dell'evento e poi CHAT_LOCKED, una sola riga di sblocco
 * per evento, limite condiviso fra i due tipi di evento.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class EventContactIntegrationTest extends ChatTestSupport {

    private static final String BODY = "{\"message\": \"Avete ancora posto per un set acustico?\"}";

    @LocalServerPort
    private int port;

    @Autowired
    private SimpMessagingTemplate template;

    private StompTestClient stomp;

    @BeforeEach
    void openClient() {
        stomp = new StompTestClient(port, template);
    }

    @AfterEach
    void closeClient() {
        stomp.close();
    }

    // ---- contatto riuscito ----

    @Test
    void contactConcert_createsConversationUnlockAndMessage_withoutFriendship() throws Exception {
        User host = user("host@example.com", "Locale");
        User fan = user("fan@example.com", "Fan");
        UUID concertId = futureConcert(host);

        String response = contactConcert(fan, concertId, BODY)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.conversationId").exists())
                .andExpect(jsonPath("$.messageId").exists())
                .andReturn().getResponse().getContentAsString();

        assertThat(conversations.count()).isEqualTo(1);
        ChatConversation conversation = conversations.findAll().get(0);
        assertThat(response).contains(conversation.getId().toString());
        var saved = messages.findAll();
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getBody())
                .isEqualTo("Contatto per «Concerto»:\nAvete ancora posto per un set acustico?");
        assertThat(saved.get(0).getSender().getId()).isEqualTo(fan.getId());
        assertThat(conversation.getLastMessageAt()).isNotNull();
        assertThat(unlockRows(conversation, "OFFICIAL_CONCERT", concertId)).isEqualTo(1);
        // Il contatto non rende amici.
        assertThat(friendships.count()).isZero();
    }

    @Test
    void contactIndieEvent_createsConversationUnlockAndMessage_withoutFriendship() throws Exception {
        User musician = user("musicista@example.com", "Musicista");
        User fan = user("fan@example.com", "Fan");
        UUID eventId = futureIndie(musician, "PUBLISHED");

        contactIndie(fan, eventId, BODY)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.conversationId").exists())
                .andExpect(jsonPath("$.messageId").exists());

        ChatConversation conversation = conversations.findAll().get(0);
        assertThat(messages.findAll().get(0).getBody())
                .isEqualTo("Contatto per «Serata»:\nAvete ancora posto per un set acustico?");
        assertThat(unlockRows(conversation, "INDIE_EVENT", eventId)).isEqualTo(1);
    }

    @Test
    void contact_deliversMessageToBoth_andNewMessageOnlyToTheOrganizer() throws Exception {
        User host = user("host@example.com", "Locale");
        User fan = user("fan@example.com", "Fan");
        UUID concertId = futureConcert(host);
        Live hostLive = live(host);
        Live fanLive = live(fan);

        contactConcert(fan, concertId, BODY).andExpect(status().isCreated());

        Map<String, Object> toHost = hostLive.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        Map<String, Object> toFan = fanLive.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        assertThat(toHost).isNotNull().containsEntry("senderId", fan.getId().toString());
        assertThat(toFan).isEqualTo(toHost);

        ChatConversation conversation = conversations.findAll().get(0);
        Map<String, Object> notification = hostLive.notifications.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS);
        assertThat(notification).isNotNull()
                .containsEntry("type", "NEW_MESSAGE")
                .containsEntry("targetId", conversation.getId().toString());
        assertThat(notification.get("preview").toString()).startsWith("Contatto per «Concerto»:");
        assertThat(notification.get("actor")).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("id", fan.getId().toString());
        // Nessuna notifica a chi ha scritto, e una sola all'organizzatore.
        assertThat(hostLive.notifications.poll(700, TimeUnit.MILLISECONDS)).isNull();
        assertThat(fanLive.notifications.poll(700, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    void withLongestTitleAndMessage_theBodyFitsTheChatMessageColumn() throws Exception {
        User host = user("host@example.com", "Locale");
        User fan = user("fan@example.com", "Fan");
        UUID concertId = futureConcert(host);
        jdbc.update("update official_concerts set title = ? where id = ?", "T".repeat(150), concertId);

        contactConcert(fan, concertId, "{\"message\": \"" + "m".repeat(1800) + "\"}")
                .andExpect(status().isCreated());

        assertThat(messages.findAll().get(0).getBody()).hasSizeLessThanOrEqualTo(2000);
    }

    // ---- sblocco ----

    @Test
    void afterContact_strangersWriteToEachOtherOverStomp() throws Exception {
        User host = user("host@example.com", "Locale");
        User fan = user("fan@example.com", "Fan");
        contactConcert(fan, futureConcert(host), BODY).andExpect(status().isCreated());
        ChatConversation conversation = conversations.findAll().get(0);
        Live hostLive = live(host);
        Live fanLive = live(fan);

        // Uno alla volta, aspettando la consegna a entrambi: due invii insieme non hanno un ordine garantito.
        hostLive.connection.send(destination(conversation), Map.of("body", "certo, scrivici"));
        assertThat(fanLive.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("body", "certo, scrivici");
        assertThat(hostLive.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("body", "certo, scrivici");

        fanLive.connection.send(destination(conversation), Map.of("body", "grazie"));
        assertThat(hostLive.messages.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("body", "grazie");
        assertThat(hostLive.errors.poll(300, TimeUnit.MILLISECONDS)).isNull();
        assertThat(fanLive.errors.poll(300, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    void onceTheEventHasStarted_theChatIsLocked_butHistoryStaysReadable() throws Exception {
        User host = user("host@example.com", "Locale");
        User fan = user("fan@example.com", "Fan");
        // Inizia fra 5 minuti: si avanza di poco perche' l'access token dura 15 minuti.
        contactConcert(fan, officialConcert(host, clock.instant().plus(Duration.ofMinutes(5))), BODY)
                .andExpect(status().isCreated());
        ChatConversation conversation = conversations.findAll().get(0);
        Live fanLive = live(fan);

        clock.advance(Duration.ofMinutes(6));
        fanLive.connection.send(destination(conversation), Map.of("body", "siete aperti?"));

        assertThat(fanLive.errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("code", "CHAT_LOCKED");
        assertThat(messages.count()).isEqualTo(1);
        mockMvc.perform(get("/api/chats/{id}/messages", conversation.getId()).header("Authorization", bearer(fan)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages.length()").value(1));
    }

    @Test
    void indieEventHiddenAfterContact_makesTheChatLocked() throws Exception {
        User musician = user("musicista@example.com", "Musicista");
        User fan = user("fan@example.com", "Fan");
        UUID eventId = futureIndie(musician, "PUBLISHED");
        contactIndie(fan, eventId, BODY).andExpect(status().isCreated());
        ChatConversation conversation = conversations.findAll().get(0);
        Live musicianLive = live(musician);
        hide("indie_events", eventId, musician);

        musicianLive.connection.send(destination(conversation), Map.of("body", "evento cancellato"));

        assertThat(musicianLive.errors.poll(StompTestClient.WAIT_SECONDS, TimeUnit.SECONDS))
                .containsEntry("code", "CHAT_LOCKED");
    }

    @Test
    void repeatedContact_keepsOneConversationAndOneUnlockRow() throws Exception {
        User host = user("host@example.com", "Locale");
        User fan = user("fan@example.com", "Fan");
        UUID concertId = futureConcert(host);

        contactConcert(fan, concertId, BODY).andExpect(status().isCreated());
        contactConcert(fan, concertId, BODY).andExpect(status().isCreated());

        assertThat(conversations.count()).isEqualTo(1);
        assertThat(messages.count()).isEqualTo(2);
        assertThat(unlockRows(conversations.findAll().get(0), "OFFICIAL_CONCERT", concertId)).isEqualTo(1);
    }

    @Test
    void thirdUser_cannotReadTheContactConversation() throws Exception {
        User host = user("host@example.com", "Locale");
        User fan = user("fan@example.com", "Fan");
        User stranger = user("estraneo@example.com", "Estraneo");
        contactConcert(fan, futureConcert(host), BODY).andExpect(status().isCreated());
        ChatConversation conversation = conversations.findAll().get(0);

        mockMvc.perform(get("/api/chats/{id}/messages", conversation.getId())
                        .header("Authorization", bearer(stranger)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_CONVERSATION_MEMBER"));
    }

    // ---- controlli ----

    @Test
    void startedEvent_returns409EventClosed_andCreatesNothing() throws Exception {
        User host = user("host@example.com", "Locale");
        User musician = user("musicista@example.com", "Musicista");
        User fan = user("fan@example.com", "Fan");
        UUID concertId = officialConcert(host, clock.instant().minus(Duration.ofHours(1)));
        UUID indieId = indieEvent(musician, clock.instant().minus(Duration.ofHours(1)), "PUBLISHED");

        contactConcert(fan, concertId, BODY)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_CLOSED"));
        contactIndie(fan, indieId, BODY)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_CLOSED"));

        assertThat(conversations.count()).isZero();
        assertThat(messages.count()).isZero();
    }

    @Test
    void ownEvent_returns400CannotContactOwnEvent() throws Exception {
        User host = user("host@example.com", "Locale");
        User musician = user("musicista@example.com", "Musicista");

        contactConcert(host, futureConcert(host), BODY)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CANNOT_CONTACT_OWN_EVENT"));
        contactIndie(musician, futureIndie(musician, "PUBLISHED"), BODY)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CANNOT_CONTACT_OWN_EVENT"));

        assertThat(conversations.count()).isZero();
    }

    @Test
    void ownStartedEvent_returns409BeforeTheOwnEventCheck() throws Exception {
        User host = user("host@example.com", "Locale");
        UUID concertId = officialConcert(host, clock.instant().minus(Duration.ofHours(1)));

        // Ordine di sezione 6.6: 404, poi 409, poi 400.
        contactConcert(host, concertId, BODY)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_CLOSED"));
    }

    @Test
    void unknownOrHiddenConcert_returns404() throws Exception {
        User host = user("host@example.com", "Locale");
        User fan = user("fan@example.com", "Fan");
        UUID hiddenId = futureConcert(host);
        hide("official_concerts", hiddenId, host);

        contactConcert(fan, UUID.randomUUID(), BODY).andExpect(status().isNotFound());
        contactConcert(fan, hiddenId, BODY)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(messages.count()).isZero();
    }

    @Test
    void draftOrHiddenIndieEvent_returns404_evenForTheOwnerOfTheDraft() throws Exception {
        User musician = user("musicista@example.com", "Musicista");
        User fan = user("fan@example.com", "Fan");
        UUID draftId = futureIndie(musician, "DRAFT");
        UUID hiddenId = futureIndie(musician, "PUBLISHED");
        hide("indie_events", hiddenId, musician);

        contactIndie(fan, draftId, BODY).andExpect(status().isNotFound());
        contactIndie(fan, hiddenId, BODY).andExpect(status().isNotFound());
        contactIndie(fan, UUID.randomUUID(), BODY).andExpect(status().isNotFound());
        // Una bozza non si contatta nemmeno dal proprietario: il 404 viene prima del 400.
        contactIndie(musician, draftId, BODY).andExpect(status().isNotFound());
        assertThat(messages.count()).isZero();
    }

    @Test
    void suspendedOrganizer_makesTheEventNotFound_withoutRevealingTheSuspension() throws Exception {
        User host = user("host@example.com", "Locale");
        User musician = user("musicista@example.com", "Musicista");
        User fan = user("fan@example.com", "Fan");
        UUID concertId = futureConcert(host);
        UUID indieId = futureIndie(musician, "PUBLISHED");
        suspended(host, fan);
        suspended(musician, fan);

        contactConcert(fan, concertId, BODY)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Concerto non trovato"));
        contactIndie(fan, indieId, BODY)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Evento non trovato"));

        assertThat(messages.count()).isZero();
    }

    @Test
    void withoutToken_returns401() throws Exception {
        UUID concertId = futureConcert(user("host@example.com", "Locale"));
        UUID indieId = futureIndie(user("musicista@example.com", "Musicista"), "PUBLISHED");

        mockMvc.perform(post("/api/official-concerts/{id}/contact", concertId)
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/indie-events/{id}/contact", indieId)
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidMessage_returns400WithFieldError() throws Exception {
        User host = user("host@example.com", "Locale");
        User fan = user("fan@example.com", "Fan");
        UUID concertId = futureConcert(host);

        for (String body : new String[]{
                "{\"message\": \"\"}", "{\"message\": \"   \"}", "{}",
                "{\"message\": \"" + "m".repeat(1801) + "\"}"}) {
            contactConcert(fan, concertId, body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.fields.message").exists());
        }
        assertThat(messages.count()).isZero();
    }

    // ---- limite ----

    @Test
    void eleventhContactInADay_returns429_sharedBetweenConcertsAndIndieEvents() throws Exception {
        User host = user("host@example.com", "Locale");
        User musician = user("musicista@example.com", "Musicista");
        User fan = user("fan@example.com", "Fan");
        UUID concertId = futureConcert(host);
        UUID indieId = futureIndie(musician, "PUBLISHED");

        for (int i = 0; i < 5; i++) {
            contactConcert(fan, concertId, BODY).andExpect(status().isCreated());
            contactIndie(fan, indieId, BODY).andExpect(status().isCreated());
        }

        contactConcert(fan, concertId, BODY)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));
        contactIndie(fan, indieId, BODY).andExpect(status().isTooManyRequests());
        assertThat(messages.count()).isEqualTo(10);
    }

    @Test
    void rejectedContacts_doNotConsumeTheLimit() throws Exception {
        User host = user("host@example.com", "Locale");
        User fan = user("fan@example.com", "Fan");
        UUID startedId = officialConcert(host, clock.instant().minus(Duration.ofHours(1)));
        UUID openId = futureConcert(host);

        for (int i = 0; i < 11; i++) {
            contactConcert(fan, startedId, BODY).andExpect(status().isConflict());
        }

        contactConcert(fan, openId, BODY).andExpect(status().isCreated());
    }

    // ---- helper ----

    private UUID futureConcert(User host) {
        return officialConcert(host, clock.instant().plus(Duration.ofDays(1)));
    }

    private UUID futureIndie(User musician, String status) {
        return indieEvent(musician, clock.instant().plus(Duration.ofDays(1)), status);
    }

    private ResultActions contactConcert(User user, UUID concertId, String json) throws Exception {
        return mockMvc.perform(post("/api/official-concerts/{id}/contact", concertId)
                .header("Authorization", bearer(user)).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private ResultActions contactIndie(User user, UUID eventId, String json) throws Exception {
        return mockMvc.perform(post("/api/indie-events/{id}/contact", eventId)
                .header("Authorization", bearer(user)).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private int unlockRows(ChatConversation conversation, String sourceType, UUID sourceId) {
        return jdbc.queryForObject("select count(*) from chat_unlocks where conversation_id = ? "
                + "and source_type = cast(? as chat_unlock_source) and source_id = ?",
                Integer.class, conversation.getId(), sourceType, sourceId);
    }

    private String destination(ChatConversation conversation) {
        return "/app/chats/" + conversation.getId() + "/send";
    }

    /** Connessione di un utente con le code di messaggi, notifiche ed errori gia' attive. */
    private Live live(User user) throws Exception {
        Connection connection = stomp.connect(accessTokens.issue(user.getId()).token());
        assertThat(connection.isConnected()).isTrue();
        BlockingQueue<Map<String, Object>> errors = connection.subscribe("/user/queue/errors", user.getId());
        BlockingQueue<Map<String, Object>> received = connection.subscribe("/user/queue/messages", user.getId());
        BlockingQueue<Map<String, Object>> notifications =
                connection.subscribe("/user/queue/notifications", user.getId());
        return new Live(connection, received, notifications, errors);
    }

    private record Live(Connection connection, BlockingQueue<Map<String, Object>> messages,
                        BlockingQueue<Map<String, Object>> notifications,
                        BlockingQueue<Map<String, Object>> errors) {
    }
}

package it.epicode.resonance.event;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.support.StubGeocodingConfig;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Concerti ufficiali via HTTP (progettazione, sezione 6.6): creazione riservata agli HOST con geocodifica
 * dell'indirizzo, dettaglio pubblico e cancellazione del proprietario (sezione 5.7).
 */
class OfficialConcertIntegrationTest extends IntegrationTest {

    @Autowired
    private AccessTokenService accessTokens;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private OfficialConcertRepository concerts;

    // ---- creazione ----

    @Test
    void create_asHost_returns201WithGeocodedCoordinates() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);

        create(host, body(StubGeocodingConfig.FLORENCE_ADDRESS))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.host.id").value(host.getId().toString()))
                .andExpect(jsonPath("$.host.displayName").value("Utente"))
                .andExpect(jsonPath("$.title").value("Concerto di prova"))
                .andExpect(jsonPath("$.venueName").value("Teatro Test"))
                .andExpect(jsonPath("$.address").value(StubGeocodingConfig.FLORENCE_ADDRESS))
                .andExpect(jsonPath("$.latitude").value(StubGeocodingConfig.FLORENCE.latitude()))
                .andExpect(jsonPath("$.longitude").value(StubGeocodingConfig.FLORENCE.longitude()))
                .andExpect(jsonPath("$.createdAt").exists())
                // distanceKm esiste solo nelle ricerche nearby (sezione 6.6).
                .andExpect(jsonPath("$.distanceKm").value(nullValue()));

        assertThat(concerts.count()).isEqualTo(1);
    }

    @Test
    void create_ignoresCoordinatesSentByTheClient() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);

        // Le coordinate vengono solo dalla geocodifica: un campo in piu' nel body non ha effetto.
        create(host, """
                {"title": "Concerto di prova", "venueName": "Teatro Test", "address": "%s",
                 "eventDate": "%s", "latitude": 10.0, "longitude": 10.0}"""
                .formatted(StubGeocodingConfig.ROME_ADDRESS, future()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.latitude").value(StubGeocodingConfig.ROME.latitude()))
                .andExpect(jsonPath("$.longitude").value(StubGeocodingConfig.ROME.longitude()));
    }

    @Test
    void create_asFan_returns403() throws Exception {
        User fan = userWith("fan@example.com", Role.FAN);

        create(fan, body(StubGeocodingConfig.FLORENCE_ADDRESS))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        assertThat(concerts.count()).isZero();
    }

    @Test
    void create_asMusicianOnly_returns403() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);

        create(musician, body(StubGeocodingConfig.FLORENCE_ADDRESS)).andExpect(status().isForbidden());
    }

    @Test
    void create_asAdminOnly_returns403() throws Exception {
        // I permessi di community non si ereditano dai ruoli di piattaforma (sezione 5.1).
        User admin = userWith("admin@example.com", Role.FAN, Role.ADMIN);

        create(admin, body(StubGeocodingConfig.FLORENCE_ADDRESS)).andExpect(status().isForbidden());
    }

    @Test
    void create_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/official-concerts").contentType(MediaType.APPLICATION_JSON)
                        .content(body(StubGeocodingConfig.FLORENCE_ADDRESS)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void create_withAddressNotFound_returns400AndSavesNothing() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);

        create(host, body(StubGeocodingConfig.NOT_FOUND_ADDRESS))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ADDRESS_NOT_FOUND"))
                .andExpect(jsonPath("$.fields.address").exists());

        assertThat(concerts.count()).isZero();
    }

    @Test
    void create_withGeocodingDown_returns502AndSavesNothing() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);

        create(host, body(StubGeocodingConfig.DOWN_ADDRESS))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("GEOCODING_UNAVAILABLE"));

        assertThat(concerts.count()).isZero();
    }

    @Test
    void create_twentyOneCreationsInADay_countingConcertsAndIndieEventsTogether_returns429() throws Exception {
        // Limite unico EVENTS_CREATED per utente (decisione 76, S3): 20 in 24 ore fra concerti e indie event.
        User both = userWith("entrambi@example.com", Role.FAN, Role.HOST, Role.MUSICIAN);
        for (int i = 0; i < 10; i++) {
            create(both, body(StubGeocodingConfig.FLORENCE_ADDRESS)).andExpect(status().isCreated());
            mockMvc.perform(post("/api/indie-events")
                            .header("Authorization", bearer(both))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body(StubGeocodingConfig.FLORENCE_ADDRESS).replace("Concerto di prova", "Serata di prova")))
                    .andExpect(status().isCreated());
        }

        create(both, body(StubGeocodingConfig.FLORENCE_ADDRESS))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));
        // Un altro utente non e' toccato dal limite.
        create(userWith("altro@example.com", Role.FAN, Role.HOST), body(StubGeocodingConfig.FLORENCE_ADDRESS))
                .andExpect(status().isCreated());
        assertThat(concerts.count()).isEqualTo(11);
    }

    @Test
    void create_rejectsDateWithoutOffset() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);

        // "2026-10-20T21:00" non dice in che fuso e': 400 sul campo eventDate, non un 500 (Review Focus 3).
        create(host, """
                {"title": "Concerto di prova", "venueName": "Teatro Test", "address": "%s",
                 "eventDate": "2030-10-20T21:00"}""".formatted(StubGeocodingConfig.FLORENCE_ADDRESS))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.eventDate").exists());

        assertThat(concerts.count()).isZero();
    }

    @Test
    void create_rejectsPastDate() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);

        create(host, bodyWithDate(StubGeocodingConfig.FLORENCE_ADDRESS, Instant.now().minus(Duration.ofDays(1))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.eventDate").exists());
    }

    @Test
    void create_normalizesGenreTags() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);

        create(host, """
                {"title": "Concerto di prova", "venueName": "Teatro Test", "address": "%s",
                 "eventDate": "%s", "genreTags": [" Rock", "rock", "JAZZ"]}"""
                .formatted(StubGeocodingConfig.FLORENCE_ADDRESS, future()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.genreTags", contains("rock", "jazz")));

        assertThat(concerts.findAll().get(0).getGenreTags()).containsExactly("rock", "jazz");
    }

    @Test
    void create_withoutGenreTags_returnsEmptyList() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);

        create(host, body(StubGeocodingConfig.FLORENCE_ADDRESS))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.genreTags").isEmpty());
    }

    @Test
    void create_rejectsTooManyOrTooLongTags() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);
        String eleven = "\"a\",\"b\",\"c\",\"d\",\"e\",\"f\",\"g\",\"h\",\"i\",\"j\",\"k\"";

        create(host, bodyWithTags(eleven)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.genreTags").exists());
        create(host, bodyWithTags("\"" + "x".repeat(31) + "\"")).andExpect(status().isBadRequest());
        create(host, bodyWithTags("\"  \"")).andExpect(status().isBadRequest());
        // Un genere null non e' un genere: 400, non un 500 ne' un null salvato nell'array.
        create(host, bodyWithTags("null")).andExpect(status().isBadRequest());
    }

    @Test
    void create_rejectsJavascriptCoverUrl() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);

        create(host, """
                {"title": "Concerto di prova", "venueName": "Teatro Test", "address": "%s",
                 "eventDate": "%s", "coverImageUrl": "javascript:x"}"""
                .formatted(StubGeocodingConfig.FLORENCE_ADDRESS, future()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.coverImageUrl").exists());
    }

    @Test
    void create_rejectsJavascriptTicketUrl() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);

        create(host, """
                {"title": "Concerto di prova", "venueName": "Teatro Test", "address": "%s",
                 "eventDate": "%s", "externalTicketUrl": "javascript:x"}"""
                .formatted(StubGeocodingConfig.FLORENCE_ADDRESS, future()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.externalTicketUrl").exists());
    }

    @Test
    void create_withInvalidFields_returnsEveryField() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);

        create(host, "{\"title\": \"ab\", \"venueName\": \" \", \"address\": \"\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.title").exists())
                .andExpect(jsonPath("$.fields.venueName").exists())
                .andExpect(jsonPath("$.fields.address").exists())
                .andExpect(jsonPath("$.fields.eventDate").exists());
    }

    @Test
    void create_emptyOptionalTexts_areStoredAsNull() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);

        create(host, """
                {"title": "Concerto di prova", "venueName": "Teatro Test", "address": "%s",
                 "eventDate": "%s", "description": "  ", "coverImageUrl": "", "externalTicketUrl": ""}"""
                .formatted(StubGeocodingConfig.FLORENCE_ADDRESS, future()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.description").value(nullValue()))
                .andExpect(jsonPath("$.coverImageUrl").value(nullValue()))
                .andExpect(jsonPath("$.externalTicketUrl").value(nullValue()));
    }

    // ---- dettaglio ----

    @Test
    void detail_isPublic() throws Exception {
        OfficialConcert concert = saved(userWith("host@example.com", Role.FAN, Role.HOST), "Concerto");

        mockMvc.perform(get("/api/official-concerts/{id}", concert.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(concert.getId().toString()))
                .andExpect(jsonPath("$.title").value("Concerto"))
                .andExpect(jsonPath("$.host.displayName").value("Utente"))
                // Nessun dato privato dell'autore (sezione 6.6: AuthorSummary).
                .andExpect(jsonPath("$.host.email").doesNotExist());
    }

    @Test
    void detail_ofHiddenConcert_returns404() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);
        OfficialConcert concert = saved(host, "Nascosto");
        concert.getModeration().hide(host.getId(), null, Instant.now());
        concerts.save(concert);

        mockMvc.perform(get("/api/official-concerts/{id}", concert.getId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void detail_ofUnknownConcert_returns404() throws Exception {
        mockMvc.perform(get("/api/official-concerts/{id}", UUID.randomUUID()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void detail_withInvalidId_returns400() throws Exception {
        mockMvc.perform(get("/api/official-concerts/non-un-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    // ---- cancellazione del proprietario ----

    @Test
    void delete_byOwner_hidesTheConcertWithReason() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);
        OfficialConcert concert = saved(host, "Da cancellare");

        mockMvc.perform(delete("/api/official-concerts/{id}", concert.getId())
                        .header("Authorization", bearer(host))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"annullato\"}"))
                .andExpect(status().isNoContent());

        OfficialConcert reloaded = concerts.findById(concert.getId()).orElseThrow();
        assertThat(reloaded.getModeration().isHidden()).isTrue();
        assertThat(reloaded.getModeration().getHiddenBy()).isEqualTo(host.getId());
        assertThat(reloaded.getModeration().getHiddenReason()).isEqualTo("annullato");
        // Cancellazione logica: la riga resta (sezione 5.7).
        assertThat(concerts.count()).isEqualTo(1);
    }

    @Test
    void delete_withoutBody_hidesTheConcertWithoutReason() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);
        OfficialConcert concert = saved(host, "Da cancellare");

        mockMvc.perform(delete("/api/official-concerts/{id}", concert.getId())
                        .header("Authorization", bearer(host)))
                .andExpect(status().isNoContent());

        OfficialConcert reloaded = concerts.findById(concert.getId()).orElseThrow();
        assertThat(reloaded.getModeration().isHidden()).isTrue();
        assertThat(reloaded.getModeration().getHiddenReason()).isNull();
    }

    @Test
    void delete_afterwards_concertIsGoneFromDetail() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);
        OfficialConcert concert = saved(host, "Da cancellare");

        mockMvc.perform(delete("/api/official-concerts/{id}", concert.getId())
                        .header("Authorization", bearer(host)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/official-concerts/{id}", concert.getId()))
                .andExpect(status().isNotFound());
    }

    @Test
    void delete_byAnotherHost_returns403NotOwner() throws Exception {
        OfficialConcert concert = saved(userWith("host@example.com", Role.FAN, Role.HOST), "Altrui");
        User other = userWith("altro@example.com", Role.FAN, Role.HOST);

        mockMvc.perform(delete("/api/official-concerts/{id}", concert.getId())
                        .header("Authorization", bearer(other)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_OWNER"));

        assertThat(concerts.findById(concert.getId()).orElseThrow().getModeration().isHidden()).isFalse();
    }

    @Test
    void delete_byAnAdmin_returns403NotOwner() throws Exception {
        // Gli admin moderano con gli endpoint dedicati (F4-03), non con la cancellazione del proprietario.
        OfficialConcert concert = saved(userWith("host@example.com", Role.FAN, Role.HOST), "Altrui");
        User admin = userWith("admin@example.com", Role.FAN, Role.ADMIN);

        mockMvc.perform(delete("/api/official-concerts/{id}", concert.getId())
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_OWNER"));
    }

    @Test
    void delete_ofAlreadyHiddenConcert_returns404() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);
        OfficialConcert concert = saved(host, "Gia' cancellato");
        concert.getModeration().hide(host.getId(), null, Instant.now());
        concerts.save(concert);

        mockMvc.perform(delete("/api/official-concerts/{id}", concert.getId())
                        .header("Authorization", bearer(host)))
                .andExpect(status().isNotFound());
    }

    @Test
    void delete_ofHiddenConcertByAnotherUser_returns404NotOwner() throws Exception {
        // Un contenuto nascosto e' un 404 per tutti: nemmeno si scopre che esiste (sezione 3.5).
        User host = userWith("host@example.com", Role.FAN, Role.HOST);
        OfficialConcert concert = saved(host, "Nascosto");
        concert.getModeration().hide(host.getId(), null, Instant.now());
        concerts.save(concert);
        User other = userWith("altro@example.com", Role.FAN, Role.HOST);

        mockMvc.perform(delete("/api/official-concerts/{id}", concert.getId())
                        .header("Authorization", bearer(other)))
                .andExpect(status().isNotFound());
    }

    @Test
    void delete_withTooLongReason_returns400() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);
        OfficialConcert concert = saved(host, "Da cancellare");

        mockMvc.perform(delete("/api/official-concerts/{id}", concert.getId())
                        .header("Authorization", bearer(host))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"" + "x".repeat(501) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.reason").exists());

        assertThat(concerts.findById(concert.getId()).orElseThrow().getModeration().isHidden()).isFalse();
    }

    @Test
    void delete_withoutToken_returns401() throws Exception {
        OfficialConcert concert = saved(userWith("host@example.com", Role.FAN, Role.HOST), "Concerto");

        mockMvc.perform(delete("/api/official-concerts/{id}", concert.getId()))
                .andExpect(status().isUnauthorized());
    }

    // ---- supporto ----

    private ResultActions create(User user, String json) throws Exception {
        return mockMvc.perform(post("/api/official-concerts")
                .header("Authorization", bearer(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    private String body(String address) {
        return bodyWithDate(address, Instant.parse(future()));
    }

    private String bodyWithDate(String address, Instant date) {
        return """
                {"title": "Concerto di prova", "venueName": "Teatro Test", "address": "%s", "eventDate": "%s"}"""
                .formatted(address, date);
    }

    private String bodyWithTags(String tagsJson) {
        return """
                {"title": "Concerto di prova", "venueName": "Teatro Test", "address": "%s",
                 "eventDate": "%s", "genreTags": [%s]}"""
                .formatted(StubGeocodingConfig.FLORENCE_ADDRESS, future(), tagsJson);
    }

    private String future() {
        return Instant.now().plus(Duration.ofDays(30)).toString();
    }

    private OfficialConcert saved(User host, String title) {
        return concerts.save(new OfficialConcert(host, title, "Teatro Test", StubGeocodingConfig.FLORENCE_ADDRESS,
                StubGeocodingConfig.FLORENCE.latitude(), StubGeocodingConfig.FLORENCE.longitude(),
                Instant.now().plus(Duration.ofDays(30))));
    }

    private User userWith(String email, Role... userRoles) {
        User user = new User(email, "hash-di-prova", "Utente");
        user.setEmailVerified(true);
        users.save(user);
        for (Role role : userRoles) {
            roles.save(new UserRole(user.getId(), role));
        }
        return user;
    }

    private String bearer(User user) {
        return "Bearer " + accessTokens.issue(user.getId()).token();
    }
}

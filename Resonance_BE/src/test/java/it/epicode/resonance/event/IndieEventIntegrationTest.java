package it.epicode.resonance.event;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.geo.Haversine;
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
import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Indie event via HTTP (progettazione, sezione 6.6): creazione riservata ai MUSICIAN con geocodifica
 * dell'indirizzo, bozze visibili solo al proprietario, pubblicazione, elenco personale, ricerca nelle
 * vicinanze (solo PUBLISHED) e cancellazione del proprietario (sezione 5.7).
 */
class IndieEventIntegrationTest extends IntegrationTest {

    @Autowired
    private AccessTokenService accessTokens;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private IndieEventRepository events;

    private static final double FLORENCE_LAT = StubGeocodingConfig.FLORENCE.latitude();
    private static final double FLORENCE_LNG = StubGeocodingConfig.FLORENCE.longitude();
    // Pistoia: circa 30 km da Firenze. Roma: circa 232 km.
    private static final double PISTOIA_LAT = 43.9330;
    private static final double PISTOIA_LNG = 10.9170;
    private static final double ROME_LAT = 41.8959;
    private static final double ROME_LNG = 12.4823;

    // ---- creazione ----

    @Test
    void create_asMusician_returns201PublishedByDefault() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);

        create(musician, body(StubGeocodingConfig.FLORENCE_ADDRESS))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.musician.id").value(musician.getId().toString()))
                .andExpect(jsonPath("$.musician.displayName").value("musicista"))
                .andExpect(jsonPath("$.title").value("Serata di prova"))
                .andExpect(jsonPath("$.latitude").value(StubGeocodingConfig.FLORENCE.latitude()))
                .andExpect(jsonPath("$.longitude").value(StubGeocodingConfig.FLORENCE.longitude()))
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.isFree").value(false))
                .andExpect(jsonPath("$.createdAt").exists())
                // distanceKm esiste solo nelle ricerche nearby (sezione 6.6).
                .andExpect(jsonPath("$.distanceKm").value(nullValue()));

        assertThat(events.count()).isEqualTo(1);
    }

    @Test
    void create_asDraftAndFree_keepsStatusAndFlag() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);

        create(musician, """
                {"title": "Serata di prova", "venueName": "Locale Test", "address": "%s",
                 "eventDate": "%s", "status": "DRAFT", "isFree": true}"""
                .formatted(StubGeocodingConfig.ROME_ADDRESS, future()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.isFree").value(true))
                .andExpect(jsonPath("$.latitude").value(StubGeocodingConfig.ROME.latitude()));
    }

    @Test
    void create_withUnknownStatus_returns400() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);

        create(musician, """
                {"title": "Serata di prova", "venueName": "Locale Test", "address": "%s",
                 "eventDate": "%s", "status": "ARCHIVED"}"""
                .formatted(StubGeocodingConfig.FLORENCE_ADDRESS, future()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        assertThat(events.count()).isZero();
    }

    @Test
    void create_asHostWithoutMusician_returns403() throws Exception {
        User host = userWith("host@example.com", Role.FAN, Role.HOST);

        create(host, body(StubGeocodingConfig.FLORENCE_ADDRESS))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        assertThat(events.count()).isZero();
    }

    @Test
    void create_asFan_returns403() throws Exception {
        User fan = userWith("fan@example.com", Role.FAN);

        create(fan, body(StubGeocodingConfig.FLORENCE_ADDRESS)).andExpect(status().isForbidden());
    }

    @Test
    void create_asAdminOnly_returns403() throws Exception {
        // I permessi di community non si ereditano dai ruoli di piattaforma (sezione 5.1).
        User admin = userWith("admin@example.com", Role.FAN, Role.ADMIN);

        create(admin, body(StubGeocodingConfig.FLORENCE_ADDRESS)).andExpect(status().isForbidden());
    }

    @Test
    void create_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/indie-events").contentType(MediaType.APPLICATION_JSON)
                        .content(body(StubGeocodingConfig.FLORENCE_ADDRESS)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void create_asMusicianAndHost_canCreateBothTypes() throws Exception {
        User both = userWith("entrambi@example.com", Role.FAN, Role.MUSICIAN, Role.HOST);

        create(both, body(StubGeocodingConfig.FLORENCE_ADDRESS)).andExpect(status().isCreated());
        mockMvc.perform(post("/api/official-concerts")
                        .header("Authorization", bearer(both))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(StubGeocodingConfig.FLORENCE_ADDRESS)))
                .andExpect(status().isCreated());
    }

    @Test
    void create_withAddressNotFound_returns400AndSavesNothing() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);

        create(musician, body(StubGeocodingConfig.NOT_FOUND_ADDRESS))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ADDRESS_NOT_FOUND"))
                .andExpect(jsonPath("$.fields.address").exists());

        assertThat(events.count()).isZero();
    }

    @Test
    void create_withGeocodingDown_returns502AndSavesNothing() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);

        create(musician, body(StubGeocodingConfig.DOWN_ADDRESS))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("GEOCODING_UNAVAILABLE"));

        assertThat(events.count()).isZero();
    }

    @Test
    void create_rejectsDateWithoutOffsetAndPastDate() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);

        create(musician, """
                {"title": "Serata di prova", "venueName": "Locale Test", "address": "%s",
                 "eventDate": "2030-10-20T21:00"}""".formatted(StubGeocodingConfig.FLORENCE_ADDRESS))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.eventDate").exists());
        create(musician, bodyWithDate(StubGeocodingConfig.FLORENCE_ADDRESS,
                Instant.now().minus(Duration.ofDays(1))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.eventDate").exists());

        assertThat(events.count()).isZero();
    }

    @Test
    void create_normalizesGenreTagsAndTexts() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);

        create(musician, """
                {"title": "  Serata di prova ", "venueName": "Locale Test", "address": "%s",
                 "eventDate": "%s", "description": "  ", "genreTags": [" Rock", "rock", "JAZZ"],
                 "coverImageUrl": ""}"""
                .formatted(StubGeocodingConfig.FLORENCE_ADDRESS, future()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Serata di prova"))
                .andExpect(jsonPath("$.genreTags", contains("rock", "jazz")))
                .andExpect(jsonPath("$.description").value(nullValue()))
                .andExpect(jsonPath("$.coverImageUrl").value(nullValue()));
    }

    @Test
    void create_rejectsBadTagsAndJavascriptUrl() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        String eleven = "\"a\",\"b\",\"c\",\"d\",\"e\",\"f\",\"g\",\"h\",\"i\",\"j\",\"k\"";

        create(musician, bodyWithTags(eleven)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.genreTags").exists());
        create(musician, bodyWithTags("\"" + "x".repeat(31) + "\"")).andExpect(status().isBadRequest());
        // Un genere null non e' un genere: 400, non un 500 ne' un null salvato nell'array.
        create(musician, bodyWithTags("null")).andExpect(status().isBadRequest());
        create(musician, bodyWithTags("\"rock\", null")).andExpect(status().isBadRequest());
        create(musician, """
                {"title": "Serata di prova", "venueName": "Locale Test", "address": "%s",
                 "eventDate": "%s", "coverImageUrl": "javascript:x"}"""
                .formatted(StubGeocodingConfig.FLORENCE_ADDRESS, future()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.coverImageUrl").exists());
    }

    @Test
    void create_ignoresCoordinatesSentByTheClient() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);

        create(musician, """
                {"title": "Serata di prova", "venueName": "Locale Test", "address": "%s",
                 "eventDate": "%s", "latitude": 10.0, "longitude": 10.0}"""
                .formatted(StubGeocodingConfig.ROME_ADDRESS, future()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.latitude").value(StubGeocodingConfig.ROME.latitude()));
    }

    @Test
    void create_withInvalidFields_returnsEveryField() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);

        create(musician, "{\"title\": \"ab\", \"venueName\": \" \", \"address\": \"\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.title").exists())
                .andExpect(jsonPath("$.fields.venueName").exists())
                .andExpect(jsonPath("$.fields.address").exists())
                .andExpect(jsonPath("$.fields.eventDate").exists());
    }

    // ---- bozze, dettaglio, publish, mine ----

    @Test
    void draft_isInvisibleToOthersAndToAnonymous_butVisibleToOwner() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        User other = userWith("altro@example.com", Role.FAN, Role.MUSICIAN);
        IndieEvent draft = saved(owner, "Bozza", IndieEventStatus.DRAFT, days(10));

        // Un altro utente e un anonimo ricevono 404: la bozza non rivela di esistere (sezione 6.6).
        mockMvc.perform(get("/api/indie-events/{id}", draft.getId()).header("Authorization", bearer(other)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(get("/api/indie-events/{id}", draft.getId()))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/indie-events/{id}", draft.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.musician.id").value(owner.getId().toString()));
    }

    @Test
    void detail_ofPublishedEvent_isPublicWithoutPrivateData() throws Exception {
        IndieEvent event = saved(userWith("musicista@example.com", Role.FAN, Role.MUSICIAN), "Serata",
                IndieEventStatus.PUBLISHED, days(10));

        mockMvc.perform(get("/api/indie-events/{id}", event.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Serata"))
                .andExpect(jsonPath("$.musician.displayName").value("musicista"))
                .andExpect(jsonPath("$.musician.email").doesNotExist());
    }

    @Test
    void detail_withInvalidTokenOnPublicEndpoint_stillWorks() throws Exception {
        IndieEvent event = saved(userWith("musicista@example.com", Role.FAN, Role.MUSICIAN), "Serata",
                IndieEventStatus.PUBLISHED, days(10));

        // Un token vecchio o malformato non blocca un endpoint pubblico.
        mockMvc.perform(get("/api/indie-events/{id}", event.getId()).header("Authorization", "Bearer non-valido"))
                .andExpect(status().isOk());
    }

    @Test
    void detail_ofHiddenOrUnknownEvent_returns404EvenForOwner() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        IndieEvent hidden = saved(owner, "Nascosto", IndieEventStatus.PUBLISHED, days(10));
        hidden.getModeration().hide(owner.getId(), null, Instant.now());
        events.save(hidden);

        mockMvc.perform(get("/api/indie-events/{id}", hidden.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/indie-events/{id}", UUID.randomUUID()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(get("/api/indie-events/non-un-uuid"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void publish_makesTheDraftAppearInNearby() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        IndieEvent draft = saved(owner, "Bozza", IndieEventStatus.DRAFT, days(10));

        nearby(FLORENCE_LAT, FLORENCE_LNG, 10).andExpect(jsonPath("$.content", hasSize(0)));

        mockMvc.perform(patch("/api/indie-events/{id}/publish", draft.getId())
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"));

        assertThat(events.findById(draft.getId()).orElseThrow().getStatus()).isEqualTo(IndieEventStatus.PUBLISHED);
        nearby(FLORENCE_LAT, FLORENCE_LNG, 10)
                .andExpect(jsonPath("$.content[*].title", contains("Bozza")));
    }

    @Test
    void publish_twice_returns409() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        IndieEvent draft = saved(owner, "Bozza", IndieEventStatus.DRAFT, days(10));

        publish(owner, draft).andExpect(status().isOk());
        publish(owner, draft)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_ALREADY_PUBLISHED"));
    }

    @Test
    void publish_ofAlreadyPublishedEvent_returns409() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        IndieEvent event = saved(owner, "Serata", IndieEventStatus.PUBLISHED, days(10));

        publish(owner, event)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_ALREADY_PUBLISHED"));
    }

    @Test
    void publish_draftWithPastDate_returns400AndStaysDraft() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        IndieEvent draft = saved(owner, "Bozza", IndieEventStatus.DRAFT, clock.instant().plus(Duration.ofDays(2)));

        // La data era futura alla creazione; il Clock dell'applicazione avanza e la bozza diventa "passata".
        clock.advance(Duration.ofDays(3));

        publish(owner, draft)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EVENT_DATE_PAST"));
        assertThat(events.findById(draft.getId()).orElseThrow().getStatus()).isEqualTo(IndieEventStatus.DRAFT);
    }

    @Test
    void publish_byAnotherUser_returns404ForDraftAnd403ForPublished() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        User other = userWith("altro@example.com", Role.FAN, Role.MUSICIAN);
        IndieEvent draft = saved(owner, "Bozza", IndieEventStatus.DRAFT, days(10));
        IndieEvent published = saved(owner, "Serata", IndieEventStatus.PUBLISHED, days(10));

        // La bozza altrui non si vede, quindi non si rivela nemmeno con un 403.
        publish(other, draft).andExpect(status().isNotFound());
        publish(other, published)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_OWNER"));
        assertThat(events.findById(draft.getId()).orElseThrow().getStatus()).isEqualTo(IndieEventStatus.DRAFT);
    }

    @Test
    void publish_byAnAdmin_isNotAllowed() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        User admin = userWith("admin@example.com", Role.FAN, Role.ADMIN);
        IndieEvent draft = saved(owner, "Bozza", IndieEventStatus.DRAFT, days(10));

        publish(admin, draft).andExpect(status().isNotFound());
        assertThat(events.findById(draft.getId()).orElseThrow().getStatus()).isEqualTo(IndieEventStatus.DRAFT);
    }

    @Test
    void publish_ofHiddenOrUnknownEvent_returns404() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        IndieEvent hidden = saved(owner, "Nascosta", IndieEventStatus.DRAFT, days(10));
        hidden.getModeration().hide(owner.getId(), null, Instant.now());
        events.save(hidden);

        publish(owner, hidden).andExpect(status().isNotFound());
        mockMvc.perform(patch("/api/indie-events/{id}/publish", UUID.randomUUID())
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void publish_withoutToken_returns401() throws Exception {
        IndieEvent draft = saved(userWith("musicista@example.com", Role.FAN, Role.MUSICIAN), "Bozza",
                IndieEventStatus.DRAFT, days(10));

        mockMvc.perform(patch("/api/indie-events/{id}/publish", draft.getId()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void mine_returnsOwnDraftsAndPublished_notOthersNorHidden() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        User other = userWith("altro@example.com", Role.FAN, Role.MUSICIAN);
        saved(owner, "Mia bozza", IndieEventStatus.DRAFT, days(10));
        saved(owner, "Mia pubblicata", IndieEventStatus.PUBLISHED, days(10));
        saved(other, "Altrui", IndieEventStatus.PUBLISHED, days(10));
        IndieEvent hidden = saved(owner, "Mia nascosta", IndieEventStatus.PUBLISHED, days(10));
        hidden.getModeration().hide(owner.getId(), null, Instant.now());
        events.save(hidden);

        mockMvc.perform(get("/api/indie-events/mine").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[*].title", containsInAnyOrder("Mia bozza", "Mia pubblicata")));
    }

    @Test
    void mine_includesPastEventsAndPaginates() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        saved(owner, "Passato", IndieEventStatus.PUBLISHED, Instant.now().minus(Duration.ofDays(5)));
        saved(owner, "Futuro", IndieEventStatus.PUBLISHED, days(5));

        mockMvc.perform(get("/api/indie-events/mine?page=0&size=1").header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(get("/api/indie-events/mine?size=0").header("Authorization", bearer(owner)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void mine_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/indie-events/mine"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    // ---- nearby ----

    @Test
    void nearby_returnsOnlyPublished_ordersByDistance_andExcludesFarPastAndHidden() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        saved(owner, "Firenze", IndieEventStatus.PUBLISHED, days(10));
        savedAt(owner, "Pistoia", IndieEventStatus.PUBLISHED, days(10), PISTOIA_LAT, PISTOIA_LNG);
        savedAt(owner, "Roma", IndieEventStatus.PUBLISHED, days(10), ROME_LAT, ROME_LNG);
        saved(owner, "Bozza", IndieEventStatus.DRAFT, days(10));
        saved(owner, "Passato", IndieEventStatus.PUBLISHED, Instant.now().minus(Duration.ofDays(1)));
        IndieEvent hidden = saved(owner, "Nascosto", IndieEventStatus.PUBLISHED, days(10));
        hidden.getModeration().hide(owner.getId(), "motivo", Instant.now());
        events.save(hidden);

        // Nessun token: la ricerca e' pubblica. Roma (circa 232 km) e' fuori da 100 km; bozza, passato e
        // nascosto non compaiono.
        nearby(FLORENCE_LAT, FLORENCE_LNG, 100)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].title", contains("Firenze", "Pistoia")))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].musician.displayName").value("musicista"))
                .andExpect(jsonPath("$.content[0].musician.email").doesNotExist())
                .andExpect(jsonPath("$.content[1].distanceKm").value(closeTo(
                        Haversine.km(FLORENCE_LAT, FLORENCE_LNG, PISTOIA_LAT, PISTOIA_LNG), 0.01)));
        nearby(FLORENCE_LAT, FLORENCE_LNG, 200)
                .andExpect(jsonPath("$.content[*].title", contains("Firenze", "Pistoia")));
        nearby(42.8, 12.0, 200)
                .andExpect(jsonPath("$.content[*].title", contains("Roma", "Firenze", "Pistoia")));
    }

    @Test
    void nearby_ownDraftIsNotShownEvenToTheOwner() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        saved(owner, "Bozza", IndieEventStatus.DRAFT, days(10));

        mockMvc.perform(get("/api/indie-events/nearby?lat=" + FLORENCE_LAT + "&lng=" + FLORENCE_LNG
                        + "&radiusKm=10").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)));
    }

    @Test
    void nearby_usesTheClockForThePast_andPaginates() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        saved(owner, "Fra due giorni", IndieEventStatus.PUBLISHED, clock.instant().plus(Duration.ofDays(2)));
        savedAt(owner, "Pistoia", IndieEventStatus.PUBLISHED, clock.instant().plus(Duration.ofDays(20)),
                PISTOIA_LAT, PISTOIA_LNG);

        mockMvc.perform(get("/api/indie-events/nearby?lat=" + FLORENCE_LAT + "&lng=" + FLORENCE_LNG
                        + "&radiusKm=100&page=0&size=1"))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));

        clock.advance(Duration.ofDays(3));
        nearby(FLORENCE_LAT, FLORENCE_LNG, 100)
                .andExpect(jsonPath("$.content[*].title", contains("Pistoia")))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void nearby_nearPoleAndInvalidParameters() throws Exception {
        saved(userWith("musicista@example.com", Role.FAN, Role.MUSICIAN), "Firenze",
                IndieEventStatus.PUBLISHED, days(10));

        nearby(89.99, 0, 50).andExpect(status().isOk()).andExpect(jsonPath("$.content", hasSize(0)));
        mockMvc.perform(get("/api/indie-events/nearby?lng=11.2&radiusKm=10"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mockMvc.perform(get("/api/indie-events/nearby?lat=91&lng=181&radiusKm=0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.lat").exists())
                .andExpect(jsonPath("$.fields.lng").exists())
                .andExpect(jsonPath("$.fields.radiusKm").exists());
        mockMvc.perform(get("/api/indie-events/nearby?lat=43.7&lng=11.2&radiusKm=10&size=1000"))
                .andExpect(status().isBadRequest());
    }

    // ---- cancellazione del proprietario ----

    @Test
    void delete_byOwner_hidesTheEventWithReason_draftsToo() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        IndieEvent published = saved(owner, "Serata", IndieEventStatus.PUBLISHED, days(10));
        IndieEvent draft = saved(owner, "Bozza", IndieEventStatus.DRAFT, days(10));

        mockMvc.perform(delete("/api/indie-events/{id}", published.getId())
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"annullata\"}"))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/indie-events/{id}", draft.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isNoContent());

        IndieEvent reloaded = events.findById(published.getId()).orElseThrow();
        assertThat(reloaded.getModeration().isHidden()).isTrue();
        assertThat(reloaded.getModeration().getHiddenBy()).isEqualTo(owner.getId());
        assertThat(reloaded.getModeration().getHiddenReason()).isEqualTo("annullata");
        assertThat(events.findById(draft.getId()).orElseThrow().getModeration().getHiddenReason()).isNull();
        // Cancellazione logica: le righe restano (sezione 5.7).
        assertThat(events.count()).isEqualTo(2);
    }

    @Test
    void delete_afterwards_eventIsGoneFromDetailNearbyAndMine() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        IndieEvent event = saved(owner, "Serata", IndieEventStatus.PUBLISHED, days(10));

        mockMvc.perform(delete("/api/indie-events/{id}", event.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/indie-events/{id}", event.getId())).andExpect(status().isNotFound());
        nearby(FLORENCE_LAT, FLORENCE_LNG, 10).andExpect(jsonPath("$.content", hasSize(0)));
        mockMvc.perform(get("/api/indie-events/mine").header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$.content", hasSize(0)));
    }

    @Test
    void delete_byAnotherUserOrAdmin_returns403NotOwnerForPublished() throws Exception {
        IndieEvent event = saved(userWith("musicista@example.com", Role.FAN, Role.MUSICIAN), "Serata",
                IndieEventStatus.PUBLISHED, days(10));
        User other = userWith("altro@example.com", Role.FAN, Role.MUSICIAN);
        // Gli admin moderano con gli endpoint dedicati (F4-03), non con la cancellazione del proprietario.
        User admin = userWith("admin@example.com", Role.FAN, Role.ADMIN);

        for (User user : new User[]{other, admin}) {
            mockMvc.perform(delete("/api/indie-events/{id}", event.getId()).header("Authorization", bearer(user)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("NOT_OWNER"));
        }
        assertThat(events.findById(event.getId()).orElseThrow().getModeration().isHidden()).isFalse();
    }

    @Test
    void delete_ofSomeoneElsesDraft_returns404() throws Exception {
        IndieEvent draft = saved(userWith("musicista@example.com", Role.FAN, Role.MUSICIAN), "Bozza",
                IndieEventStatus.DRAFT, days(10));
        User other = userWith("altro@example.com", Role.FAN, Role.MUSICIAN);

        mockMvc.perform(delete("/api/indie-events/{id}", draft.getId()).header("Authorization", bearer(other)))
                .andExpect(status().isNotFound());
        assertThat(events.findById(draft.getId()).orElseThrow().getModeration().isHidden()).isFalse();
    }

    @Test
    void delete_ofAlreadyHiddenEvent_returns404() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        IndieEvent event = saved(owner, "Serata", IndieEventStatus.PUBLISHED, days(10));
        event.getModeration().hide(owner.getId(), null, Instant.now());
        events.save(event);

        mockMvc.perform(delete("/api/indie-events/{id}", event.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void delete_withTooLongReason_returns400_andWithoutToken401() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        IndieEvent event = saved(owner, "Serata", IndieEventStatus.PUBLISHED, days(10));

        mockMvc.perform(delete("/api/indie-events/{id}", event.getId())
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"" + "x".repeat(501) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.reason").exists());
        mockMvc.perform(delete("/api/indie-events/{id}", event.getId())).andExpect(status().isUnauthorized());
        assertThat(events.findById(event.getId()).orElseThrow().getModeration().isHidden()).isFalse();
    }

    // ---- supporto ----

    private ResultActions publish(User user, IndieEvent event) throws Exception {
        return mockMvc.perform(patch("/api/indie-events/{id}/publish", event.getId())
                .header("Authorization", bearer(user)));
    }

    private ResultActions nearby(double lat, double lng, double radiusKm) throws Exception {
        return mockMvc.perform(get("/api/indie-events/nearby?lat=" + lat + "&lng=" + lng + "&radiusKm=" + radiusKm));
    }

    private Instant days(int days) {
        return Instant.now().plus(Duration.ofDays(days));
    }

    private IndieEvent saved(User musician, String title, IndieEventStatus status, Instant date) {
        return savedAt(musician, title, status, date, FLORENCE_LAT, FLORENCE_LNG);
    }

    private IndieEvent savedAt(User musician, String title, IndieEventStatus status, Instant date, double lat,
                               double lng) {
        IndieEvent event = new IndieEvent(musician, title, "Locale Test", StubGeocodingConfig.FLORENCE_ADDRESS,
                lat, lng, date);
        event.setStatus(status);
        return events.save(event);
    }

    @Test
    void create_twentyOneCreationsInADay_returns429AndTheWindowSlides() throws Exception {
        User musician = userWith("musicista-limite@example.com", Role.FAN, Role.MUSICIAN);
        for (int i = 0; i < 20; i++) {
            create(musician, body(StubGeocodingConfig.FLORENCE_ADDRESS)).andExpect(status().isCreated());
        }

        create(musician, body(StubGeocodingConfig.FLORENCE_ADDRESS))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));
        assertThat(events.count()).isEqualTo(20);

        // Passate le 24 ore si puo' creare di nuovo (il bearer si riemette: quello vecchio e' scaduto).
        clock.advance(Duration.ofHours(25));
        create(musician, body(StubGeocodingConfig.FLORENCE_ADDRESS)).andExpect(status().isCreated());
    }

    private ResultActions create(User user, String json) throws Exception {
        return mockMvc.perform(post("/api/indie-events")
                .header("Authorization", bearer(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    private String body(String address) {
        return bodyWithDate(address, Instant.parse(future()));
    }

    private String bodyWithDate(String address, Instant date) {
        return """
                {"title": "Serata di prova", "venueName": "Locale Test", "address": "%s", "eventDate": "%s"}"""
                .formatted(address, date);
    }

    private String bodyWithTags(String tagsJson) {
        return """
                {"title": "Serata di prova", "venueName": "Locale Test", "address": "%s",
                 "eventDate": "%s", "genreTags": [%s]}"""
                .formatted(StubGeocodingConfig.FLORENCE_ADDRESS, future(), tagsJson);
    }

    private String future() {
        return Instant.now().plus(Duration.ofDays(30)).toString();
    }

    private User userWith(String email, Role... userRoles) {
        User user = new User(email, "hash-di-prova", email.substring(0, email.indexOf('@')));
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

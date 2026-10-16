package it.epicode.resonance.feed;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.geo.Haversine;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Feed via HTTP (progettazione, sezioni 3.4, 6.8 e 10.2): creazione di un utente qualsiasi con coordinate
 * facoltative (entrambe o nessuna), dettaglio e lista pubblici, filtro per raggio, like e unlike idempotenti e
 * cancellazione del proprietario (sezione 5.7). Il centro delle ricerche e' Firenze.
 */
class FeedIntegrationTest extends IntegrationTest {

    private static final double FLORENCE_LAT = 43.7696;
    private static final double FLORENCE_LNG = 11.2558;
    // Pistoia: circa 30 km da Firenze. Roma: circa 232 km.
    private static final double PISTOIA_LAT = 43.9330;
    private static final double PISTOIA_LNG = 10.9170;
    private static final double ROME_LAT = 41.8959;
    private static final double ROME_LNG = 12.4823;

    @Autowired
    private AccessTokenService accessTokens;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private FeedPostRepository posts;

    @Autowired
    private PostLikeRepository likes;

    @Autowired
    private JdbcTemplate jdbc;

    // ---- creazione ----

    @Test
    void create_asFan_returns201() throws Exception {
        User fan = userWith("fan@example.com", Role.FAN);

        create(fan, """
                {"body": "  Che serata! ", "imageUrl": "https://example.com/foto.jpg",
                 "latitude": 43.77, "longitude": 11.25}""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.author.id").value(fan.getId().toString()))
                .andExpect(jsonPath("$.author.displayName").value("Utente"))
                .andExpect(jsonPath("$.author.email").doesNotExist())
                .andExpect(jsonPath("$.body").value("Che serata!"))
                .andExpect(jsonPath("$.imageUrl").value("https://example.com/foto.jpg"))
                .andExpect(jsonPath("$.latitude").value(43.77))
                .andExpect(jsonPath("$.longitude").value(11.25))
                .andExpect(jsonPath("$.likesCount").value(0))
                .andExpect(jsonPath("$.likedByMe").value(false))
                .andExpect(jsonPath("$.createdAt").exists())
                .andExpect(jsonPath("$.distanceKm").value(nullValue()));

        assertThat(posts.count()).isEqualTo(1);
    }

    @Test
    void create_withoutOptionalFields_returns201() throws Exception {
        create(userWith("fan@example.com", Role.FAN), "{\"body\": \"Solo testo\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.imageUrl").value(nullValue()))
                .andExpect(jsonPath("$.latitude").value(nullValue()))
                .andExpect(jsonPath("$.longitude").value(nullValue()));
    }

    @Test
    void create_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/feed-posts").contentType(MediaType.APPLICATION_JSON).content("{\"body\": \"Ciao\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        assertThat(posts.count()).isZero();
    }

    @Test
    void create_withOnlyOneCoordinate_returns400OnBothFields() throws Exception {
        User fan = userWith("fan@example.com", Role.FAN);

        create(fan, "{\"body\": \"Ciao\", \"latitude\": 43.77}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.latitude").exists())
                .andExpect(jsonPath("$.fields.longitude").exists());
        create(fan, "{\"body\": \"Ciao\", \"longitude\": 11.25}").andExpect(status().isBadRequest());

        assertThat(posts.count()).isZero();
    }

    @Test
    void create_withInvalidFields_returns400WithTheFieldNames() throws Exception {
        User fan = userWith("fan@example.com", Role.FAN);

        create(fan, """
                {"body": "   ", "imageUrl": "javascript:alert(1)", "latitude": 91, "longitude": -181}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.body").exists())
                .andExpect(jsonPath("$.fields.imageUrl").exists())
                .andExpect(jsonPath("$.fields.latitude").exists())
                .andExpect(jsonPath("$.fields.longitude").exists());
        create(fan, "{\"body\": \"%s\"}".formatted("b".repeat(2001)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.body").exists());
        create(fan, "{}").andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.body").exists());

        assertThat(posts.count()).isZero();
    }

    // ---- dettaglio ----

    @Test
    void detail_isPublic_andShowsAuthorWithoutPrivateData() throws Exception {
        FeedPost post = saved(userWith("fan@example.com", Role.FAN), "Un post");

        // Nessun token: il dettaglio e' pubblico, likedByMe e' falso.
        mockMvc.perform(get("/api/feed-posts/{id}", post.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(post.getId().toString()))
                .andExpect(jsonPath("$.body").value("Un post"))
                .andExpect(jsonPath("$.author.displayName").value("Utente"))
                .andExpect(jsonPath("$.author.email").doesNotExist())
                .andExpect(jsonPath("$.likedByMe").value(false))
                .andExpect(jsonPath("$.distanceKm").value(nullValue()));
    }

    @Test
    void detail_ofHiddenOrUnknownPost_returns404() throws Exception {
        User author = userWith("fan@example.com", Role.FAN);
        FeedPost hidden = saved(author, "Nascosto");
        hidden.getModeration().hide(author.getId(), "motivo", Instant.now());
        posts.save(hidden);

        mockMvc.perform(get("/api/feed-posts/{id}", hidden.getId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(get("/api/feed-posts/{id}", UUID.randomUUID())).andExpect(status().isNotFound());
    }

    // ---- lista ----

    @Test
    void list_isPublic_showsVisiblePostsNewestFirst_withAndWithoutCoordinates() throws Exception {
        User author = userWith("fan@example.com", Role.FAN);
        FeedPost oldest = saved(author, "Il piu' vecchio");
        FeedPost located = savedAt(author, "Con coordinate", PISTOIA_LAT, PISTOIA_LNG);
        FeedPost newest = saved(author, "Il piu' recente");
        FeedPost hidden = saved(author, "Nascosto");
        hidden.getModeration().hide(author.getId(), "motivo", Instant.now());
        posts.save(hidden);

        // Nessun token e nessun filtro: tutti i non nascosti, anche senza coordinate. Nascosto escluso.
        mockMvc.perform(get("/api/feed-posts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[*].id", contains(newest.getId().toString(),
                        located.getId().toString(), oldest.getId().toString())))
                .andExpect(jsonPath("$.content[0].author.displayName").value("Utente"))
                .andExpect(jsonPath("$.content[0].author.email").doesNotExist())
                .andExpect(jsonPath("$.content[0].likedByMe").value(false))
                .andExpect(jsonPath("$.content[0].distanceKm").value(nullValue()));
    }

    @Test
    void list_withRadius_returnsOnlyPostsWithCoordinatesInRange_newestFirst() throws Exception {
        User author = userWith("fan@example.com", Role.FAN);
        FeedPost rome = savedAt(author, "Roma", ROME_LAT, ROME_LNG);
        FeedPost pistoia = savedAt(author, "Pistoia", PISTOIA_LAT, PISTOIA_LNG);
        saved(author, "Senza coordinate");
        FeedPost florence = savedAt(author, "Firenze", FLORENCE_LAT, FLORENCE_LNG);

        // Solo i post con coordinate nel raggio, dal piu' recente (non dal piu' vicino): Roma e' a 232 km.
        list(FLORENCE_LAT, FLORENCE_LNG, 100)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[*].id", contains(florence.getId().toString(),
                        pistoia.getId().toString())))
                .andExpect(jsonPath("$.content[0].distanceKm").value(closeTo(0, 0.01)))
                .andExpect(jsonPath("$.content[1].distanceKm").isNumber());
        // Da un centro piu' a sud entra anche Roma.
        list(42.8, 12.0, 200)
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[*].id", contains(florence.getId().toString(),
                        pistoia.getId().toString(), rome.getId().toString())));
    }

    @Test
    void list_withRadius_excludesHiddenPosts() throws Exception {
        User author = userWith("fan@example.com", Role.FAN);
        FeedPost visible = savedAt(author, "Visibile", FLORENCE_LAT, FLORENCE_LNG);
        FeedPost hidden = savedAt(author, "Nascosto", FLORENCE_LAT, FLORENCE_LNG);
        hidden.getModeration().hide(author.getId(), "motivo", Instant.now());
        posts.save(hidden);

        list(FLORENCE_LAT, FLORENCE_LNG, 10)
                .andExpect(jsonPath("$.content[*].id", contains(visible.getId().toString())))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void list_withRadius_sqlDistanceMatchesHaversine() throws Exception {
        savedAt(userWith("fan@example.com", Role.FAN), "Pistoia", PISTOIA_LAT, PISTOIA_LNG);

        // La query SQL e Haversine.km usano la stessa formula e lo stesso raggio terrestre: stessa distanza.
        list(FLORENCE_LAT, FLORENCE_LNG, 100)
                .andExpect(jsonPath("$.content[0].distanceKm")
                        .value(closeTo(Haversine.km(FLORENCE_LAT, FLORENCE_LNG, PISTOIA_LAT, PISTOIA_LNG), 0.01)));
    }

    @Test
    void list_withRadius_paginatesAndCountsAllMatches() throws Exception {
        User author = userWith("fan@example.com", Role.FAN);
        FeedPost first = savedAt(author, "Primo", FLORENCE_LAT, FLORENCE_LNG);
        FeedPost second = savedAt(author, "Secondo", PISTOIA_LAT, PISTOIA_LNG);

        mockMvc.perform(get(listUrl(FLORENCE_LAT, FLORENCE_LNG, 100) + "&page=0&size=1"))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(second.getId().toString()))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(get(listUrl(FLORENCE_LAT, FLORENCE_LNG, 100) + "&page=1&size=1"))
                .andExpect(jsonPath("$.content[0].id").value(first.getId().toString()));
        mockMvc.perform(get(listUrl(FLORENCE_LAT, FLORENCE_LNG, 100) + "&page=5&size=1"))
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void list_withoutFilter_paginatesAndRejectsOutOfRangeParameters() throws Exception {
        User author = userWith("fan@example.com", Role.FAN);
        saved(author, "Primo");
        saved(author, "Secondo");

        mockMvc.perform(get("/api/feed-posts?page=0&size=1"))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(get("/api/feed-posts?size=1000"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mockMvc.perform(get("/api/feed-posts?page=-1")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/feed-posts?size=0")).andExpect(status().isBadRequest());
    }

    @Test
    void list_withIncompleteFilter_returns400NamingTheMissingParameters() throws Exception {
        savedAt(userWith("fan@example.com", Role.FAN), "Firenze", FLORENCE_LAT, FLORENCE_LNG);

        // Il filtro vale solo con tutti e tre i parametri: ne basta uno assente per avere 400.
        mockMvc.perform(get("/api/feed-posts?lat=43.7"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.lng").exists())
                .andExpect(jsonPath("$.fields.radiusKm").exists())
                .andExpect(jsonPath("$.fields.lat").doesNotExist());
        mockMvc.perform(get("/api/feed-posts?lat=43.7&lng=11.2"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.radiusKm").exists());
        mockMvc.perform(get("/api/feed-posts?radiusKm=10"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.lat").exists())
                .andExpect(jsonPath("$.fields.lng").exists());
        mockMvc.perform(get("/api/feed-posts?lng=11.2&radiusKm=10")).andExpect(status().isBadRequest());
    }

    @Test
    void list_withOutOfRangeOrNonNumericFilter_returns400() throws Exception {
        mockMvc.perform(get("/api/feed-posts?lat=91&lng=181&radiusKm=0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.lat").exists())
                .andExpect(jsonPath("$.fields.lng").exists())
                .andExpect(jsonPath("$.fields.radiusKm").exists());
        list(FLORENCE_LAT, FLORENCE_LNG, 240)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.radiusKm").exists());
        mockMvc.perform(get("/api/feed-posts?lat=abc&lng=11.2&radiusKm=10"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void list_nearPole_doesNotFail() throws Exception {
        savedAt(userWith("fan@example.com", Role.FAN), "Firenze", FLORENCE_LAT, FLORENCE_LNG);

        // Vicino ai poli cos(lat) tende a zero: la bounding box non deve dare Infinity o NaN (Review Focus 4).
        list(89.99, 0, 50).andExpect(status().isOk()).andExpect(jsonPath("$.content", hasSize(0)));
    }

    @Test
    void list_likedByMe_isTrueOnlyForTheCallersLikes() throws Exception {
        User author = userWith("autore@example.com", Role.FAN);
        User viewer = userWith("lettore@example.com", Role.FAN);
        User other = userWith("altro@example.com", Role.FAN);
        FeedPost likedByViewer = saved(author, "Piace al lettore");
        FeedPost likedByOther = saved(author, "Piace a un altro");
        FeedPost notLiked = saved(author, "Senza like");
        likes.saveAndFlush(new PostLike(viewer.getId(), likedByViewer.getId()));
        likes.saveAndFlush(new PostLike(other.getId(), likedByOther.getId()));

        mockMvc.perform(get("/api/feed-posts").header("Authorization", bearer(viewer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(notLiked.getId().toString()))
                .andExpect(jsonPath("$.content[0].likedByMe").value(false))
                .andExpect(jsonPath("$.content[1].id").value(likedByOther.getId().toString()))
                .andExpect(jsonPath("$.content[1].likedByMe").value(false))
                .andExpect(jsonPath("$.content[2].id").value(likedByViewer.getId().toString()))
                .andExpect(jsonPath("$.content[2].likedByMe").value(true));
        // Anonimo, oppure con un token non valido (pagina pubblica): likedByMe sempre falso.
        mockMvc.perform(get("/api/feed-posts"))
                .andExpect(jsonPath("$.content[2].likedByMe").value(false));
        mockMvc.perform(get("/api/feed-posts").header("Authorization", "Bearer non-valido"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[2].likedByMe").value(false));
    }

    @Test
    void list_withRadius_likedByMeIsComputedToo() throws Exception {
        User author = userWith("autore@example.com", Role.FAN);
        User viewer = userWith("lettore@example.com", Role.FAN);
        FeedPost post = savedAt(author, "Firenze", FLORENCE_LAT, FLORENCE_LNG);
        likes.saveAndFlush(new PostLike(viewer.getId(), post.getId()));

        mockMvc.perform(get(listUrl(FLORENCE_LAT, FLORENCE_LNG, 10)).header("Authorization", bearer(viewer)))
                .andExpect(jsonPath("$.content[0].likedByMe").value(true));
        list(FLORENCE_LAT, FLORENCE_LNG, 10).andExpect(jsonPath("$.content[0].likedByMe").value(false));
    }

    @Test
    void detail_likedByMe_isTrueForTheLiker() throws Exception {
        User author = userWith("autore@example.com", Role.FAN);
        User viewer = userWith("lettore@example.com", Role.FAN);
        FeedPost post = saved(author, "Un post");
        likes.saveAndFlush(new PostLike(viewer.getId(), post.getId()));

        mockMvc.perform(get("/api/feed-posts/{id}", post.getId()).header("Authorization", bearer(viewer)))
                .andExpect(jsonPath("$.likedByMe").value(true));
        mockMvc.perform(get("/api/feed-posts/{id}", post.getId()).header("Authorization", bearer(author)))
                .andExpect(jsonPath("$.likedByMe").value(false));
    }

    // ---- like e unlike ----

    @Test
    void like_twice_countsOnlyOnce_andReturnsTheStatus() throws Exception {
        FeedPost post = saved(userWith("autore@example.com", Role.FAN), "Un post");
        User fan = userWith("fan@example.com", Role.FAN);

        like(fan, post).andExpect(status().isOk())
                .andExpect(jsonPath("$.likesCount").value(1))
                .andExpect(jsonPath("$.likedByMe").value(true));
        // Secondo like dello stesso utente: stesso esito, nessun errore, contatore invariato (idempotente).
        like(fan, post).andExpect(status().isOk())
                .andExpect(jsonPath("$.likesCount").value(1))
                .andExpect(jsonPath("$.likedByMe").value(true));

        assertThat(likes.count()).isEqualTo(1);
        assertThat(likesCountOf(post)).isEqualTo(1);
        mockMvc.perform(get("/api/feed-posts/{id}", post.getId()).header("Authorization", bearer(fan)))
                .andExpect(jsonPath("$.likesCount").value(1))
                .andExpect(jsonPath("$.likedByMe").value(true));
    }

    @Test
    void like_byDifferentUsers_addsUp_andTheAuthorCanLikeOwnPost() throws Exception {
        User author = userWith("autore@example.com", Role.FAN);
        FeedPost post = saved(author, "Un post");

        like(userWith("uno@example.com", Role.FAN), post).andExpect(jsonPath("$.likesCount").value(1));
        like(userWith("due@example.com", Role.FAN), post).andExpect(jsonPath("$.likesCount").value(2));
        like(author, post).andExpect(status().isOk()).andExpect(jsonPath("$.likesCount").value(3));

        assertThat(likesCountOf(post)).isEqualTo(3);
    }

    @Test
    void unlike_removesTheLike_andTwiceNeverGoesBelowZero() throws Exception {
        FeedPost post = saved(userWith("autore@example.com", Role.FAN), "Un post");
        User fan = userWith("fan@example.com", Role.FAN);
        User other = userWith("altro@example.com", Role.FAN);
        like(fan, post);
        like(other, post);

        unlike(fan, post).andExpect(status().isOk())
                .andExpect(jsonPath("$.likesCount").value(1))
                .andExpect(jsonPath("$.likedByMe").value(false));
        // Secondo unlike: nessun errore e il like dell'altro utente non viene toccato.
        unlike(fan, post).andExpect(status().isOk())
                .andExpect(jsonPath("$.likesCount").value(1))
                .andExpect(jsonPath("$.likedByMe").value(false));
        unlike(other, post).andExpect(jsonPath("$.likesCount").value(0));
        unlike(other, post).andExpect(status().isOk()).andExpect(jsonPath("$.likesCount").value(0));

        assertThat(likes.count()).isZero();
        assertThat(likesCountOf(post)).isZero();
    }

    @Test
    void unlike_withoutAPreviousLike_leavesTheCounterAtZero() throws Exception {
        FeedPost post = saved(userWith("autore@example.com", Role.FAN), "Un post");

        unlike(userWith("fan@example.com", Role.FAN), post).andExpect(status().isOk())
                .andExpect(jsonPath("$.likesCount").value(0))
                .andExpect(jsonPath("$.likedByMe").value(false));

        assertThat(likesCountOf(post)).isZero();
    }

    @Test
    void likeAgainAfterUnlike_countsAgain() throws Exception {
        FeedPost post = saved(userWith("autore@example.com", Role.FAN), "Un post");
        User fan = userWith("fan@example.com", Role.FAN);

        like(fan, post);
        unlike(fan, post);
        like(fan, post).andExpect(jsonPath("$.likesCount").value(1)).andExpect(jsonPath("$.likedByMe").value(true));
    }

    @Test
    void likeAndUnlike_ofHiddenOrUnknownPost_return404() throws Exception {
        User author = userWith("autore@example.com", Role.FAN);
        User fan = userWith("fan@example.com", Role.FAN);
        FeedPost hidden = saved(author, "Nascosto");
        hidden.getModeration().hide(author.getId(), null, Instant.now());
        posts.save(hidden);

        like(fan, hidden).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        unlike(fan, hidden).andExpect(status().isNotFound());
        mockMvc.perform(put("/api/feed-posts/{id}/like", UUID.randomUUID()).header("Authorization", bearer(fan)))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/feed-posts/{id}/like", UUID.randomUUID()).header("Authorization", bearer(fan)))
                .andExpect(status().isNotFound());

        assertThat(likes.count()).isZero();
    }

    @Test
    void likeAndUnlike_withoutToken_return401() throws Exception {
        FeedPost post = saved(userWith("autore@example.com", Role.FAN), "Un post");

        mockMvc.perform(put("/api/feed-posts/{id}/like", post.getId()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mockMvc.perform(delete("/api/feed-posts/{id}/like", post.getId()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        assertThat(likes.count()).isZero();
    }

    // ---- cancellazione del proprietario ----

    @Test
    void delete_byOwner_hidesThePostWithReason() throws Exception {
        User owner = userWith("fan@example.com", Role.FAN);
        FeedPost withReason = saved(owner, "Con motivo");
        FeedPost withoutReason = saved(owner, "Senza motivo");

        mockMvc.perform(delete("/api/feed-posts/{id}", withReason.getId())
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"errore\"}"))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/feed-posts/{id}", withoutReason.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isNoContent());

        FeedPost reloaded = posts.findById(withReason.getId()).orElseThrow();
        assertThat(reloaded.getModeration().isHidden()).isTrue();
        assertThat(reloaded.getModeration().getHiddenBy()).isEqualTo(owner.getId());
        assertThat(reloaded.getModeration().getHiddenReason()).isEqualTo("errore");
        assertThat(posts.findById(withoutReason.getId()).orElseThrow().getModeration().getHiddenReason()).isNull();
        // Cancellazione logica: le righe restano (sezione 5.7).
        assertThat(posts.count()).isEqualTo(2);
        mockMvc.perform(get("/api/feed-posts/{id}", withReason.getId())).andExpect(status().isNotFound());
    }

    @Test
    void delete_byAnotherUserOrAdmin_returns403NotOwner() throws Exception {
        FeedPost post = saved(userWith("fan@example.com", Role.FAN), "Un post");
        User other = userWith("altro@example.com", Role.FAN);
        // Gli admin moderano con gli endpoint dedicati (F4-03), non con la cancellazione del proprietario.
        User admin = userWith("admin@example.com", Role.FAN, Role.ADMIN);

        for (User user : new User[]{other, admin}) {
            mockMvc.perform(delete("/api/feed-posts/{id}", post.getId()).header("Authorization", bearer(user)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("NOT_OWNER"));
        }
        assertThat(posts.findById(post.getId()).orElseThrow().getModeration().isHidden()).isFalse();
    }

    @Test
    void delete_ofHiddenPost_returns404_andWithoutToken401() throws Exception {
        User owner = userWith("fan@example.com", Role.FAN);
        FeedPost hidden = saved(owner, "Nascosto");
        hidden.getModeration().hide(owner.getId(), null, Instant.now());
        posts.save(hidden);
        FeedPost visible = saved(owner, "Visibile");

        mockMvc.perform(delete("/api/feed-posts/{id}", hidden.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/feed-posts/{id}", visible.getId()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        assertThat(posts.findById(visible.getId()).orElseThrow().getModeration().isHidden()).isFalse();
    }

    @Test
    void delete_withTooLongReason_returns400() throws Exception {
        User owner = userWith("fan@example.com", Role.FAN);
        FeedPost post = saved(owner, "Un post");

        mockMvc.perform(delete("/api/feed-posts/{id}", post.getId())
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"" + "x".repeat(501) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.reason").exists());
        assertThat(posts.findById(post.getId()).orElseThrow().getModeration().isHidden()).isFalse();
    }

    // ---- supporto ----

    private ResultActions create(User user, String json) throws Exception {
        return mockMvc.perform(post("/api/feed-posts")
                .header("Authorization", bearer(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    private ResultActions like(User user, FeedPost post) throws Exception {
        return mockMvc.perform(put("/api/feed-posts/{id}/like", post.getId()).header("Authorization", bearer(user)));
    }

    private ResultActions unlike(User user, FeedPost post) throws Exception {
        return mockMvc.perform(delete("/api/feed-posts/{id}/like", post.getId())
                .header("Authorization", bearer(user)));
    }

    // Il contatore letto dal database, non dall'entity gia' in cache.
    private int likesCountOf(FeedPost post) {
        return jdbc.queryForObject("select likes_count from feed_posts where id = ?", Integer.class, post.getId());
    }

    private ResultActions list(double lat, double lng, double radiusKm) throws Exception {
        return mockMvc.perform(get(listUrl(lat, lng, radiusKm)));
    }

    private String listUrl(double lat, double lng, double radiusKm) {
        return "/api/feed-posts?lat=" + lat + "&lng=" + lng + "&radiusKm=" + radiusKm;
    }

    private FeedPost savedAt(User author, String body, double lat, double lng) {
        FeedPost post = new FeedPost(author, body);
        post.setLatitude(lat);
        post.setLongitude(lng);
        FeedPost saved = posts.saveAndFlush(post);
        pause();
        return saved;
    }

    private FeedPost saved(User author, String body) {
        // Una pausa di 5 ms evita date di creazione identiche, che renderebbero ambiguo l'ordine.
        FeedPost post = posts.saveAndFlush(new FeedPost(author, body));
        pause();
        return post;
    }

    private void pause() {
        try {
            Thread.sleep(Duration.ofMillis(5));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
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

package it.epicode.resonance.moderation;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.collab.CollabPost;
import it.epicode.resonance.collab.CollabPostRepository;
import it.epicode.resonance.event.IndieEvent;
import it.epicode.resonance.event.IndieEventRepository;
import it.epicode.resonance.event.OfficialConcert;
import it.epicode.resonance.event.OfficialConcertRepository;
import it.epicode.resonance.feed.FeedPost;
import it.epicode.resonance.feed.FeedPostRepository;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Moderazione degli admin sui quattro tipi di contenuto, con la vera catena di sicurezza (progettazione, sezioni
 * 5.6, 5.7 e 6.10): hide e restore, motivo obbligatorio, regola dei livelli, contenuti cancellati dal proprietario
 * e elenco dei nascosti.
 */
class ModerationIntegrationTest extends IntegrationTest {

    private static final String REASON = "{\"reason\":\"Contenuto offensivo\"}";

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private AccessTokenService accessTokens;

    @Autowired
    private OfficialConcertRepository concerts;

    @Autowired
    private IndieEventRepository indieEvents;

    @Autowired
    private FeedPostRepository feedPosts;

    @Autowired
    private CollabPostRepository collabPosts;

    // ---------------------------------------------------------------- hide e restore

    @ParameterizedTest
    @EnumSource(ModeratedContentType.class)
    void hide_removesContentFromPublicView_andRestoreBringsItBack(ModeratedContentType type) throws Exception {
        User admin = userWith(Role.ADMIN);
        UUID id = createContent(type, userWith(Role.HOST, Role.MUSICIAN));

        publicDetail(type, id).andExpect(status().isOk());

        hide(type, id, admin, REASON).andExpect(status().isNoContent());
        publicDetail(type, id).andExpect(status().isNotFound());

        restore(type, id, admin).andExpect(status().isNoContent());
        publicDetail(type, id).andExpect(status().isOk());
    }

    @Test
    void hide_storesAdminAndReason_andRestoreClearsThem() throws Exception {
        User admin = userWith(Role.ADMIN);
        UUID id = createContent(ModeratedContentType.FEED_POST, userWith());

        hide(ModeratedContentType.FEED_POST, id, admin, "{\"reason\":\"  Spam ripetuto  \"}")
                .andExpect(status().isNoContent());

        Moderation hidden = feedPosts.findById(id).orElseThrow().getModeration();
        assertThat(hidden.getHiddenBy()).isEqualTo(admin.getId());
        assertThat(hidden.getHiddenReason()).isEqualTo("Spam ripetuto");
        assertThat(hidden.getHiddenAt()).isNotNull();

        restore(ModeratedContentType.FEED_POST, id, admin).andExpect(status().isNoContent());

        assertThat(feedPosts.findById(id).orElseThrow().getModeration().isHidden()).isFalse();
    }

    @ParameterizedTest
    @EnumSource(ModeratedContentType.class)
    void hide_withoutValidReason_returns400(ModeratedContentType type) throws Exception {
        User admin = userWith(Role.ADMIN);
        UUID id = createContent(type, userWith(Role.HOST, Role.MUSICIAN));

        hide(type, id, admin, "{}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.reason").exists());
        hide(type, id, admin, "{\"reason\":\"   \"}").andExpect(status().isBadRequest());
        hide(type, id, admin, "{\"reason\":\"ab\"}").andExpect(status().isBadRequest());
        hide(type, id, admin, "{\"reason\":\"" + "x".repeat(501) + "\"}").andExpect(status().isBadRequest());

        publicDetail(type, id).andExpect(status().isOk());
    }

    @Test
    void hide_unknownType_returns400() throws Exception {
        User admin = userWith(Role.ADMIN);

        mockMvc.perform(post("/api/admin/moderation/songs/" + UUID.randomUUID() + "/hide")
                        .header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON).content(REASON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void hide_missingContent_returns404() throws Exception {
        hide(ModeratedContentType.COLLAB_POST, UUID.randomUUID(), userWith(Role.ADMIN), REASON)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void hide_twice_returns409() throws Exception {
        User admin = userWith(Role.ADMIN);
        UUID id = createContent(ModeratedContentType.COLLAB_POST, userWith(Role.MUSICIAN));

        hide(ModeratedContentType.COLLAB_POST, id, admin, REASON).andExpect(status().isNoContent());

        hide(ModeratedContentType.COLLAB_POST, id, admin, REASON)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONTENT_ALREADY_HIDDEN"));
    }

    @Test
    void restore_ofVisibleContent_returns409() throws Exception {
        UUID id = createContent(ModeratedContentType.FEED_POST, userWith());

        restore(ModeratedContentType.FEED_POST, id, userWith(Role.ADMIN))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONTENT_NOT_HIDDEN"));
    }

    // Il proprietario che cancella nasconde con hidden_by = se stesso: l'admin non puo' annullarlo (sezione 5.7).
    @ParameterizedTest
    @EnumSource(ModeratedContentType.class)
    void restore_ofContentDeletedByOwner_returns409(ModeratedContentType type) throws Exception {
        User owner = userWith(Role.HOST, Role.MUSICIAN);
        UUID id = createContent(type, owner);

        mockMvc.perform(delete("/api/" + type.path() + "/" + id).header("Authorization", bearer(owner)))
                .andExpect(status().isNoContent());

        restore(type, id, userWith(Role.ADMIN))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESTORE_NOT_ALLOWED"));
        publicDetail(type, id).andExpect(status().isNotFound());
    }

    // ---------------------------------------------------------------- regola dei livelli

    @ParameterizedTest
    @EnumSource(ModeratedContentType.class)
    void adminCannotHideContentOfAnotherAdmin_butSuperadminCan(ModeratedContentType type) throws Exception {
        User authorAdmin = userWith(Role.ADMIN, Role.HOST, Role.MUSICIAN);
        UUID id = createContent(type, authorAdmin);

        hide(type, id, userWith(Role.ADMIN), REASON)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_PLATFORM_LEVEL"));
        publicDetail(type, id).andExpect(status().isOk());

        User superadmin = userWith(Role.SUPERADMIN);
        hide(type, id, superadmin, REASON).andExpect(status().isNoContent());
        publicDetail(type, id).andExpect(status().isNotFound());

        // Anche il ripristino segue la regola: un admin non puo', lo SUPERADMIN si'.
        restore(type, id, userWith(Role.ADMIN))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_PLATFORM_LEVEL"));
        restore(type, id, superadmin).andExpect(status().isNoContent());
        publicDetail(type, id).andExpect(status().isOk());
    }

    @Test
    void adminCannotHideOwnContent() throws Exception {
        User admin = userWith(Role.ADMIN);
        UUID id = createContent(ModeratedContentType.FEED_POST, admin);

        hide(ModeratedContentType.FEED_POST, id, admin, REASON)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_PLATFORM_LEVEL"));
    }

    @Test
    void adminCanModerateContentOfCommunityUsers() throws Exception {
        UUID id = createContent(ModeratedContentType.FEED_POST, userWith(Role.MUSICIAN));

        hide(ModeratedContentType.FEED_POST, id, userWith(Role.ADMIN), REASON).andExpect(status().isNoContent());
    }

    // ---------------------------------------------------------------- elenco dei nascosti

    // Un contenuto nascosto da un admin e uno cancellato dal proprietario compaiono entrambi, con il flag giusto;
    // il piu' recente per primo e il contenuto visibile resta fuori.
    @ParameterizedTest
    @EnumSource(ModeratedContentType.class)
    void hiddenList_includesAdminHiddenAndOwnerDeleted_withFlag_mostRecentFirst(ModeratedContentType type)
            throws Exception {
        User admin = userWith(Role.ADMIN);
        User owner = userWith(Role.HOST, Role.MUSICIAN);
        UUID hiddenByAdmin = createContent(type, owner);
        UUID deletedByOwner = createContent(type, owner);
        UUID visible = createContent(type, owner);

        hide(type, hiddenByAdmin, admin, REASON).andExpect(status().isNoContent());
        clock.advance(Duration.ofMinutes(1));
        mockMvc.perform(delete("/api/" + type.path() + "/" + deletedByOwner).header("Authorization", bearer(owner)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/admin/moderation/" + type.path() + "/hidden").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.content[0].id").value(deletedByOwner.toString()))
                .andExpect(jsonPath("$.content[0].deletedByOwner").value(true))
                .andExpect(jsonPath("$.content[0].hiddenBy").value(owner.getId().toString()))
                .andExpect(jsonPath("$.content[1].id").value(hiddenByAdmin.toString()))
                .andExpect(jsonPath("$.content[1].deletedByOwner").value(false))
                .andExpect(jsonPath("$.content[1].hiddenBy").value(admin.getId().toString()))
                .andExpect(jsonPath("$.content[1].hiddenReason").value("Contenuto offensivo"))
                .andExpect(jsonPath("$.content[1].author.id").value(owner.getId().toString()))
                .andExpect(jsonPath("$.content[1].title").isNotEmpty())
                .andExpect(jsonPath("$.content[1].hiddenAt").isNotEmpty())
                .andExpect(jsonPath("$.content[?(@.id == '" + visible + "')]").isEmpty());
    }

    @Test
    void hiddenList_isPaginated_andRejectsOutOfRangeSize() throws Exception {
        User admin = userWith(Role.ADMIN);
        User author = userWith();
        for (int i = 0; i < 3; i++) {
            UUID id = createContent(ModeratedContentType.FEED_POST, author);
            hide(ModeratedContentType.FEED_POST, id, admin, REASON).andExpect(status().isNoContent());
        }

        mockMvc.perform(get("/api/admin/moderation/feed-posts/hidden?page=1&size=2")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(get("/api/admin/moderation/feed-posts/hidden?size=1000")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void hiddenList_longFeedPostBody_isShortenedToAnExcerpt() throws Exception {
        User admin = userWith(Role.ADMIN);
        UUID id = feedPosts.save(new FeedPost(userWith(), "a".repeat(400))).getId();
        hide(ModeratedContentType.FEED_POST, id, admin, REASON).andExpect(status().isNoContent());

        String title = mockMvc.perform(get("/api/admin/moderation/feed-posts/hidden")
                        .header("Authorization", bearer(admin)))
                .andReturn().getResponse().getContentAsString();

        assertThat(title).doesNotContain("a".repeat(400)).contains("a".repeat(50));
    }

    @Test
    void hiddenList_unknownType_returns400() throws Exception {
        mockMvc.perform(get("/api/admin/moderation/songs/hidden").header("Authorization", bearer(userWith(Role.ADMIN))))
                .andExpect(status().isBadRequest());
    }

    // ---------------------------------------------------------------- accesso

    @Test
    void moderationEndpoints_requireAdmin() throws Exception {
        UUID id = createContent(ModeratedContentType.FEED_POST, userWith());
        User fan = userWith(Role.MUSICIAN, Role.HOST);
        String path = "/api/admin/moderation/feed-posts/" + id;

        hide(ModeratedContentType.FEED_POST, id, fan, REASON).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        restore(ModeratedContentType.FEED_POST, id, fan).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/moderation/feed-posts/hidden").header("Authorization", bearer(fan)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(path + "/hide").contentType(MediaType.APPLICATION_JSON).content(REASON))
                .andExpect(status().isUnauthorized());
        publicDetail(ModeratedContentType.FEED_POST, id).andExpect(status().isOk());
    }

    // ---------------------------------------------------------------- supporto

    private ResultActions hide(ModeratedContentType type, UUID id, User actor, String body) throws Exception {
        return mockMvc.perform(post("/api/admin/moderation/" + type.path() + "/" + id + "/hide")
                .header("Authorization", bearer(actor)).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions restore(ModeratedContentType type, UUID id, User actor) throws Exception {
        return mockMvc.perform(post("/api/admin/moderation/" + type.path() + "/" + id + "/restore")
                .header("Authorization", bearer(actor)));
    }

    private ResultActions publicDetail(ModeratedContentType type, UUID id) throws Exception {
        return mockMvc.perform(get("/api/" + type.path() + "/" + id));
    }

    /** Crea un contenuto visibile del tipo dato e ne restituisce l'id. */
    private UUID createContent(ModeratedContentType type, User author) {
        return switch (type) {
            case OFFICIAL_CONCERT -> concerts.save(new OfficialConcert(author, "Concerto", "Locale", "Via Roma 1",
                    45.0, 9.0, clock.instant().plus(Duration.ofDays(30)))).getId();
            case INDIE_EVENT -> indieEvents.save(new IndieEvent(author, "Serata indie", "Locale", "Via Roma 1",
                    45.0, 9.0, clock.instant().plus(Duration.ofDays(30)))).getId();
            case FEED_POST -> feedPosts.save(new FeedPost(author, "Un post del feed")).getId();
            case COLLAB_POST -> collabPosts.save(new CollabPost(author, "Cerco un bassista", "Band rock", "Bassista"))
                    .getId();
        };
    }

    private User userWith(Role... extraRoles) {
        User user = new User("utente-" + UUID.randomUUID() + "@example.com", "hash-non-usato", "Utente " + UUID.randomUUID());
        user.setEmailVerified(true);
        users.save(user);
        roles.save(new UserRole(user.getId(), Role.FAN));
        for (Role role : extraRoles) {
            roles.save(new UserRole(user.getId(), role));
        }
        return user;
    }

    private String bearer(User user) {
        return "Bearer " + accessTokens.issue(user.getId()).token();
    }
}

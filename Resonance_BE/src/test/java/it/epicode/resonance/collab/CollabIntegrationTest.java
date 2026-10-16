package it.epicode.resonance.collab;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.support.IntegrationTest;
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
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Annunci di collaborazione via HTTP (progettazione, sezione 6.7, senza le candidature di F5-03): creazione
 * riservata ai MUSICIAN, lista pubblica dei soli annunci aperti e non nascosti, dettaglio anche dei chiusi,
 * chiusura idempotente e cancellazione del proprietario (sezione 5.7).
 */
class CollabIntegrationTest extends IntegrationTest {

    @Autowired
    private AccessTokenService accessTokens;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private CollabPostRepository posts;

    // ---- creazione ----

    @Test
    void create_asMusician_returns201AndNormalizesTags() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);

        create(musician, """
                {"title": "  Cerco batterista ", "description": "Band indie", "roleNeeded": "Batterista",
                 "genreTags": [" Rock", "rock", "JAZZ"], "location": "Firenze"}""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.musician.id").value(musician.getId().toString()))
                .andExpect(jsonPath("$.musician.displayName").value("Utente"))
                .andExpect(jsonPath("$.title").value("Cerco batterista"))
                .andExpect(jsonPath("$.roleNeeded").value("Batterista"))
                .andExpect(jsonPath("$.genreTags", contains("rock", "jazz")))
                .andExpect(jsonPath("$.location").value("Firenze"))
                .andExpect(jsonPath("$.isOpen").value(true))
                .andExpect(jsonPath("$.createdAt").exists());

        assertThat(posts.count()).isEqualTo(1);
    }

    @Test
    void create_withoutOptionalFields_returns201() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);

        create(musician, """
                {"title": "Cerco bassista", "description": "Band indie", "roleNeeded": "Bassista"}""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.genreTags", hasSize(0)))
                .andExpect(jsonPath("$.location").value(nullValue()));
    }

    @Test
    void create_asFan_returns403() throws Exception {
        create(userWith("fan@example.com", Role.FAN), validBody())
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        assertThat(posts.count()).isZero();
    }

    @Test
    void create_asHostOrAdminOnly_returns403() throws Exception {
        // I permessi di community non si ereditano dai ruoli di piattaforma (sezione 5.1).
        create(userWith("host@example.com", Role.FAN, Role.HOST), validBody()).andExpect(status().isForbidden());
        create(userWith("admin@example.com", Role.FAN, Role.ADMIN), validBody()).andExpect(status().isForbidden());

        assertThat(posts.count()).isZero();
    }

    @Test
    void create_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/collab-posts").contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void create_withoutRoleNeeded_returns400() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);

        create(musician, """
                {"title": "Cerco batterista", "description": "Band indie"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.roleNeeded").exists());

        assertThat(posts.count()).isZero();
    }

    @Test
    void create_withInvalidFields_returns400WithTheFieldNames() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);

        // Titolo di 2 caratteri, descrizione di soli spazi, ruolo oltre 100, luogo oltre 150, 11 generi.
        create(musician, """
                {"title": "ab", "description": "   ", "roleNeeded": "%s", "location": "%s",
                 "genreTags": ["a","b","c","d","e","f","g","h","i","l","m"]}"""
                .formatted("r".repeat(101), "l".repeat(151)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.title").exists())
                .andExpect(jsonPath("$.fields.description").exists())
                .andExpect(jsonPath("$.fields.roleNeeded").exists())
                .andExpect(jsonPath("$.fields.location").exists())
                .andExpect(jsonPath("$.fields.genreTags").exists());

        assertThat(posts.count()).isZero();
    }

    @Test
    void create_withTooLongDescriptionOrTag_returns400() throws Exception {
        User musician = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);

        create(musician, """
                {"title": "Cerco batterista", "description": "%s", "roleNeeded": "Batterista"}"""
                .formatted("d".repeat(5001)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.description").exists());
        create(musician, """
                {"title": "Cerco batterista", "description": "Band", "roleNeeded": "Batterista",
                 "genreTags": ["%s"]}""".formatted("g".repeat(31)))
                .andExpect(status().isBadRequest());

        assertThat(posts.count()).isZero();
    }

    // ---- lista ----

    @Test
    void list_isPublic_showsOnlyOpenAndVisible_newestFirst() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        CollabPost oldest = saved(owner, "Il piu' vecchio");
        CollabPost newest = saved(owner, "Il piu' recente");
        CollabPost closed = saved(owner, "Chiuso");
        closed.setOpen(false);
        posts.save(closed);
        CollabPost hidden = saved(owner, "Nascosto");
        hidden.getModeration().hide(owner.getId(), "motivo", Instant.now());
        posts.save(hidden);

        // Nessun token: la lista e' pubblica. Chiuso e nascosto non compaiono.
        mockMvc.perform(get("/api/collab-posts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[*].id", contains(newest.getId().toString(),
                        oldest.getId().toString())))
                .andExpect(jsonPath("$.content[0].musician.displayName").value("Utente"))
                .andExpect(jsonPath("$.content[0].musician.email").doesNotExist());
    }

    @Test
    void list_paginatesAndRejectsOutOfRangeParameters() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        saved(owner, "Primo");
        saved(owner, "Secondo");

        mockMvc.perform(get("/api/collab-posts?page=0&size=1"))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(get("/api/collab-posts?size=1000"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mockMvc.perform(get("/api/collab-posts?page=-1")).andExpect(status().isBadRequest());
    }

    // ---- dettaglio ----

    @Test
    void detail_isPublic_andShowsClosedPosts() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        CollabPost closed = saved(owner, "Chiuso");
        closed.setOpen(false);
        posts.save(closed);

        mockMvc.perform(get("/api/collab-posts/{id}", closed.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(closed.getId().toString()))
                .andExpect(jsonPath("$.isOpen").value(false))
                .andExpect(jsonPath("$.musician.id").value(owner.getId().toString()));
    }

    @Test
    void detail_ofHiddenOrUnknownPost_returns404() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        CollabPost hidden = saved(owner, "Nascosto");
        hidden.getModeration().hide(owner.getId(), null, Instant.now());
        posts.save(hidden);

        mockMvc.perform(get("/api/collab-posts/{id}", hidden.getId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(get("/api/collab-posts/{id}", UUID.randomUUID())).andExpect(status().isNotFound());
    }

    // ---- close ----

    @Test
    void close_byOwner_closesThePost_andIsIdempotent() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        CollabPost post = saved(owner, "Annuncio");

        close(owner, post).andExpect(status().isOk()).andExpect(jsonPath("$.isOpen").value(false));
        // Seconda chiusura: stesso esito, nessun errore (sezione 6.7).
        close(owner, post).andExpect(status().isOk()).andExpect(jsonPath("$.isOpen").value(false));

        assertThat(posts.findById(post.getId()).orElseThrow().isOpen()).isFalse();
        mockMvc.perform(get("/api/collab-posts")).andExpect(jsonPath("$.content", hasSize(0)));
    }

    @Test
    void close_byAnotherUserOrAdmin_returns403NotOwner() throws Exception {
        CollabPost post = saved(userWith("musicista@example.com", Role.FAN, Role.MUSICIAN), "Annuncio");
        User other = userWith("altro@example.com", Role.FAN, Role.MUSICIAN);
        User admin = userWith("admin@example.com", Role.FAN, Role.ADMIN);

        for (User user : new User[]{other, admin}) {
            close(user, post)
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("NOT_OWNER"));
        }
        assertThat(posts.findById(post.getId()).orElseThrow().isOpen()).isTrue();
    }

    @Test
    void close_ofHiddenOrUnknownPost_returns404() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        CollabPost hidden = saved(owner, "Nascosto");
        hidden.getModeration().hide(owner.getId(), null, Instant.now());
        posts.save(hidden);

        close(owner, hidden).andExpect(status().isNotFound());
        mockMvc.perform(patch("/api/collab-posts/{id}/close", UUID.randomUUID())
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void close_withoutToken_returns401() throws Exception {
        CollabPost post = saved(userWith("musicista@example.com", Role.FAN, Role.MUSICIAN), "Annuncio");

        mockMvc.perform(patch("/api/collab-posts/{id}/close", post.getId()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    // ---- cancellazione del proprietario ----

    @Test
    void delete_byOwner_hidesThePostWithReason_closedToo() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        CollabPost open = saved(owner, "Aperto");
        CollabPost closed = saved(owner, "Chiuso");
        closed.setOpen(false);
        posts.save(closed);

        mockMvc.perform(delete("/api/collab-posts/{id}", open.getId())
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"trovato\"}"))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/collab-posts/{id}", closed.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isNoContent());

        CollabPost reloaded = posts.findById(open.getId()).orElseThrow();
        assertThat(reloaded.getModeration().isHidden()).isTrue();
        assertThat(reloaded.getModeration().getHiddenBy()).isEqualTo(owner.getId());
        assertThat(reloaded.getModeration().getHiddenReason()).isEqualTo("trovato");
        assertThat(posts.findById(closed.getId()).orElseThrow().getModeration().getHiddenReason()).isNull();
        // Cancellazione logica: le righe restano (sezione 5.7).
        assertThat(posts.count()).isEqualTo(2);
    }

    @Test
    void delete_afterwards_postIsGoneFromDetailAndList() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        CollabPost post = saved(owner, "Annuncio");

        mockMvc.perform(delete("/api/collab-posts/{id}", post.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/collab-posts/{id}", post.getId())).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/collab-posts")).andExpect(jsonPath("$.content", hasSize(0)));
    }

    @Test
    void delete_byAnotherUserOrAdmin_returns403NotOwner() throws Exception {
        CollabPost post = saved(userWith("musicista@example.com", Role.FAN, Role.MUSICIAN), "Annuncio");
        User other = userWith("altro@example.com", Role.FAN, Role.MUSICIAN);
        // Gli admin moderano con gli endpoint dedicati (F4-03), non con la cancellazione del proprietario.
        User admin = userWith("admin@example.com", Role.FAN, Role.ADMIN);

        for (User user : new User[]{other, admin}) {
            mockMvc.perform(delete("/api/collab-posts/{id}", post.getId()).header("Authorization", bearer(user)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("NOT_OWNER"));
        }
        assertThat(posts.findById(post.getId()).orElseThrow().getModeration().isHidden()).isFalse();
    }

    @Test
    void delete_ofAlreadyHiddenPost_returns404() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        CollabPost post = saved(owner, "Annuncio");
        post.getModeration().hide(owner.getId(), null, Instant.now());
        posts.save(post);

        mockMvc.perform(delete("/api/collab-posts/{id}", post.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void delete_withTooLongReason_returns400_andWithoutToken401() throws Exception {
        User owner = userWith("musicista@example.com", Role.FAN, Role.MUSICIAN);
        CollabPost post = saved(owner, "Annuncio");

        mockMvc.perform(delete("/api/collab-posts/{id}", post.getId())
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"" + "x".repeat(501) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.reason").exists());
        mockMvc.perform(delete("/api/collab-posts/{id}", post.getId())).andExpect(status().isUnauthorized());
        assertThat(posts.findById(post.getId()).orElseThrow().getModeration().isHidden()).isFalse();
    }

    // ---- supporto ----

    private ResultActions close(User user, CollabPost post) throws Exception {
        return mockMvc.perform(patch("/api/collab-posts/{id}/close", post.getId())
                .header("Authorization", bearer(user)));
    }

    private CollabPost saved(User musician, String title) {
        // Una pausa di 1 ms evita date di creazione identiche, che renderebbero ambiguo l'ordine.
        CollabPost post = posts.saveAndFlush(new CollabPost(musician, title, "Descrizione", "Batterista"));
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

    private ResultActions create(User user, String json) throws Exception {
        return mockMvc.perform(post("/api/collab-posts")
                .header("Authorization", bearer(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    private String validBody() {
        return """
                {"title": "Cerco batterista", "description": "Band indie", "roleNeeded": "Batterista"}""";
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

package it.epicode.resonance.feed;

import it.epicode.resonance.auth.AccessTokenService;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * Like simultanei (progettazione, sezione 3.4): il contatore si incrementa nel database, non con "leggi, somma,
 * salva" in Java, quindi nessun aggiornamento va perso; lo stesso like ripetuto in parallelo conta una volta sola.
 */
class LikeConcurrencyTest extends IntegrationTest {

    private static final int USERS = 10;

    @Autowired
    private AccessTokenService accessTokens;

    @Autowired
    private UserRepository users;

    @Autowired
    private FeedPostRepository posts;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void tenUsersLikingAtTheSameTime_countExactlyTen() throws Exception {
        FeedPost post = post();
        List<String> tokens = new ArrayList<>();
        for (int i = 0; i < USERS; i++) {
            tokens.add(token(user("fan" + i + "@example.com")));
        }

        // Ogni utente mette like dal proprio thread; il latch li fa partire tutti insieme.
        runTogether(tokens.stream().<Callable<Integer>>map(token -> () -> likeStatus(post, token, true)).toList());

        assertThat(likesCountOf(post)).isEqualTo(USERS);
        assertThat(jdbc.queryForObject("select count(*) from post_likes where post_id = ?", Integer.class,
                post.getId())).isEqualTo(USERS);
    }

    @Test
    void sameUserLikingTenTimesAtTheSameTime_countsOnce() throws Exception {
        FeedPost post = post();
        String token = token(user("fan@example.com"));

        List<Integer> statuses = runTogether(IntStream.range(0, USERS)
                .<Callable<Integer>>mapToObj(i -> () -> likeStatus(post, token, true)).toList());

        // Nessuna richiesta fallisce (nemmeno per la chiave duplicata) e il contatore e' 1.
        assertThat(statuses).containsOnly(200);
        assertThat(likesCountOf(post)).isEqualTo(1);
    }

    @Test
    void likesAndUnlikesAtTheSameTime_keepCounterEqualToTheLikeRows() throws Exception {
        FeedPost post = post();
        List<String> tokens = new ArrayList<>();
        for (int i = 0; i < USERS; i++) {
            tokens.add(token(user("fan" + i + "@example.com")));
        }
        // I primi cinque hanno gia' il like e lo tolgono mentre gli altri cinque lo mettono.
        for (int i = 0; i < USERS / 2; i++) {
            likeStatus(post, tokens.get(i), true);
        }
        List<Callable<Integer>> calls = new ArrayList<>();
        for (int i = 0; i < USERS; i++) {
            String token = tokens.get(i);
            boolean add = i >= USERS / 2;
            calls.add(() -> likeStatus(post, token, add));
        }

        runTogether(calls);

        assertThat(likesCountOf(post)).isEqualTo(USERS / 2);
        assertThat(jdbc.queryForObject("select count(*) from post_likes where post_id = ?", Integer.class,
                post.getId())).isEqualTo(USERS / 2);
    }

    // ---- supporto ----

    /**
     * Esegue le chiamate in parallelo, una per thread, facendole partire insieme, e ne restituisce gli esiti.
     */
    private <T> List<T> runTogether(List<Callable<T>> calls) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(calls.size());
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<T>> futures = new ArrayList<>();
            for (Callable<T> call : calls) {
                futures.add(executor.submit(() -> {
                    start.await();
                    return call.call();
                }));
            }
            start.countDown();
            List<T> results = new ArrayList<>();
            for (Future<T> future : futures) {
                results.add(future.get(30, TimeUnit.SECONDS));
            }
            return results;
        } finally {
            executor.shutdownNow();
        }
    }

    private int likeStatus(FeedPost post, String token, boolean add) throws Exception {
        var request = add ? put("/api/feed-posts/{id}/like", post.getId())
                : delete("/api/feed-posts/{id}/like", post.getId());
        return mockMvc.perform(request.header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getStatus();
    }

    // Il contatore letto dal database, non dall'entity gia' in cache.
    private int likesCountOf(FeedPost post) {
        return jdbc.queryForObject("select likes_count from feed_posts where id = ?", Integer.class, post.getId());
    }

    private FeedPost post() {
        return posts.saveAndFlush(new FeedPost(user("autore@example.com"), "Un post"));
    }

    private User user(String email) {
        User user = new User(email, "hash-di-prova", email.substring(0, email.indexOf('@')));
        user.setEmailVerified(true);
        return users.save(user);
    }

    private String token(User user) {
        return accessTokens.issue(user.getId()).token();
    }
}

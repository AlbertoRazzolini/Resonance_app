package it.epicode.resonance.friendship;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.PageParams;
import it.epicode.resonance.common.PageResponse;
import it.epicode.resonance.friendship.dto.UserSearchResult;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Ricerca utenti a livello di service (progettazione, sezione 6.5): filtri sulla query, escape dei jolly del LIKE,
 * ordine, paginazione e stato dell'amicizia per ogni risultato. Il comportamento HTTP e' in UserSearchIntegrationTest.
 */
class UserSearchServiceTest extends IntegrationTest {

    @Autowired
    private UserSearchService search;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private FriendshipRepository friendships;

    @Test
    void search_matchesSubstringIgnoringCase_orderedByNameThenId() {
        User me = user("me@example.com", "Io");
        user("b@example.com", "Marco Bianchi");
        user("a@example.com", "anna MARCOni");
        user("c@example.com", "Zeno");

        PageResponse<UserSearchResult> result = search.search(me.getId(), "marco", new PageParams(null, null));

        assertThat(result.content()).extracting(UserSearchResult::displayName)
                .containsExactly("anna MARCOni", "Marco Bianchi");
        assertThat(result.totalElements()).isEqualTo(2);
    }

    @Test
    void search_excludesSelfUnverifiedAndSuspended() {
        User me = user("me@example.com", "Luca Me");
        user("ok@example.com", "Luca Ok");
        User unverified = user("u@example.com", "Luca Non Verificato");
        unverified.setEmailVerified(false);
        users.save(unverified);
        User suspended = user("s@example.com", "Luca Sospeso");
        suspended.setStatus(UserStatus.SUSPENDED);
        suspended.setSuspendedAt(Instant.now());
        suspended.setSuspendedBy(me.getId());
        suspended.setSuspensionReason("prova");
        users.save(suspended);

        PageResponse<UserSearchResult> result = search.search(me.getId(), "luca", new PageParams(null, null));

        assertThat(result.content()).extracting(UserSearchResult::displayName).containsExactly("Luca Ok");
    }

    @Test
    void search_searchesOnlyDisplayName_notEmail() {
        User me = user("me@example.com", "Io");
        user("segreto@example.com", "Anna");

        assertThat(search.search(me.getId(), "segreto", new PageParams(null, null)).content()).isEmpty();
    }

    @Test
    void search_wildcardsAreLiteral() {
        User me = user("me@example.com", "Io");
        user("a@example.com", "Sconto 50% Band");
        user("b@example.com", "Sconto 500 Band");
        user("c@example.com", "Mia_Band");
        user("d@example.com", "MiaXBand");

        assertThat(search.search(me.getId(), "50%", new PageParams(null, null)).content())
                .extracting(UserSearchResult::displayName).containsExactly("Sconto 50% Band");
        assertThat(search.search(me.getId(), "a_b", new PageParams(null, null)).content())
                .extracting(UserSearchResult::displayName).containsExactly("Mia_Band");
    }

    @Test
    void search_isPaginated() {
        User me = user("me@example.com", "Io");
        user("a@example.com", "Bea 1");
        user("b@example.com", "Bea 2");
        user("c@example.com", "Bea 3");

        PageResponse<UserSearchResult> second = search.search(me.getId(), "bea", new PageParams(1, 2));

        assertThat(second.content()).extracting(UserSearchResult::displayName).containsExactly("Bea 3");
        assertThat(second.totalElements()).isEqualTo(3);
        assertThat(second.totalPages()).isEqualTo(2);
    }

    @Test
    void search_trimsTheQuery() {
        User me = user("me@example.com", "Io");
        user("a@example.com", "Carla");

        assertThat(search.search(me.getId(), "  carla  ", new PageParams(null, null)).content()).hasSize(1);
    }

    @Test
    void search_queryOutsideTwoToFiftyCharactersAfterTrim_isRejected() {
        User me = user("me@example.com", "Io");

        for (String q : new String[]{"a", " a ", "   ", "x".repeat(51)}) {
            assertThatThrownBy(() -> search.search(me.getId(), q, new PageParams(null, null)))
                    .isInstanceOfSatisfying(AppException.class, ex -> {
                        assertThat(ex.getCode()).isEqualTo(ErrorCode.VALIDATION_ERROR);
                        assertThat(ex.getFields()).containsKey("q");
                    });
        }
        // I limiti sono inclusi.
        search.search(me.getId(), "ab", new PageParams(null, null));
        search.search(me.getId(), "x".repeat(50), new PageParams(null, null));
    }

    @Test
    void search_reportsFriendshipStatusAndIdOnlyWhereNeeded() {
        User me = user("me@example.com", "Io");
        User none = user("n@example.com", "Test Nessuno");
        User outgoing = user("o@example.com", "Test Inviata");
        User incoming = user("i@example.com", "Test Ricevuta");
        User friend = user("f@example.com", "Test Amico");
        User removedByThem = user("r@example.com", "Test Rimossa");
        Friendship out = row(me, outgoing, FriendshipStatus.PENDING);
        Friendship in = row(incoming, me, FriendshipStatus.PENDING);
        Friendship fr = row(friend, me, FriendshipStatus.ACCEPTED);
        Friendship removed = new Friendship(me, removedByThem, FriendshipStatus.REMOVED, Instant.now());
        removed.setClosedBy(removedByThem.getId());
        friendships.saveAndFlush(removed);

        PageResponse<UserSearchResult> result = search.search(me.getId(), "test", new PageParams(null, null));

        assertThat(result.content()).hasSize(5);
        assertThat(of(result, none).friendship().status()).isEqualTo(FriendshipView.NONE);
        assertThat(of(result, none).friendship().friendshipId()).isNull();
        assertThat(of(result, outgoing).friendship().status()).isEqualTo(FriendshipView.OUTGOING);
        assertThat(of(result, outgoing).friendship().friendshipId()).isEqualTo(out.getId());
        assertThat(of(result, incoming).friendship().status()).isEqualTo(FriendshipView.INCOMING);
        assertThat(of(result, incoming).friendship().friendshipId()).isEqualTo(in.getId());
        assertThat(of(result, friend).friendship().status()).isEqualTo(FriendshipView.FRIENDS);
        assertThat(of(result, friend).friendship().friendshipId()).isEqualTo(fr.getId());
        // UNAVAILABLE: l'altro ha rimosso l'amicizia, quindi niente id e niente pulsante "Aggiungi".
        assertThat(of(result, removedByThem).friendship().status()).isEqualTo(FriendshipView.UNAVAILABLE);
        assertThat(of(result, removedByThem).friendship().friendshipId()).isNull();
    }

    private static UserSearchResult of(PageResponse<UserSearchResult> result, User user) {
        return result.content().stream().filter(r -> r.id().equals(user.getId())).findFirst().orElseThrow();
    }

    private Friendship row(User requester, User addressee, FriendshipStatus status) {
        return friendships.saveAndFlush(new Friendship(requester, addressee, status, Instant.now()));
    }

    private User user(String email, String displayName) {
        User user = new User(email, "hash-di-prova", displayName);
        user.setEmailVerified(true);
        users.save(user);
        roles.save(new UserRole(user.getId(), Role.FAN));
        return user;
    }
}

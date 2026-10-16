package it.epicode.resonance.friendship;

import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Mappatura di Friendship sulla tabella della V8 (progettazione, sezione 3.2): campi, default, vincoli del
 * database e letture con lock (l'avvio con ddl-auto validate controlla il resto).
 */
class FriendshipPersistenceTest extends IntegrationTest {

    @Autowired
    private FriendshipRepository friendships;

    @Autowired
    private UserRepository users;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private TransactionTemplate transaction;

    @Test
    void saveAndReload_keepsAllFields() {
        User a = user("a@example.com");
        User b = user("b@example.com");
        Instant when = Instant.parse("2026-10-16T10:00:00Z");

        Friendship saved = friendships.saveAndFlush(new Friendship(a, b, FriendshipStatus.PENDING, when));
        Friendship found = friendships.findById(saved.getId()).orElseThrow();

        assertThat(found.getRequester().getId()).isEqualTo(a.getId());
        assertThat(found.getAddressee().getId()).isEqualTo(b.getId());
        assertThat(found.getStatus()).isEqualTo(FriendshipStatus.PENDING);
        assertThat(found.getClosedBy()).isNull();
        assertThat(found.isRequestMasked()).isFalse();
        assertThat(found.getUpdatedAt()).isEqualTo(when);
        // createdAt arriva dal DEFAULT now() del database.
        assertThat(found.getCreatedAt()).isNotNull();
    }

    @Test
    void declinedRowWithClosedByAndMask_isPersisted() {
        User a = user("a@example.com");
        User b = user("b@example.com");
        Friendship row = new Friendship(a, b, FriendshipStatus.DECLINED, Instant.now());
        row.setClosedBy(b.getId());
        row.setRequestMasked(true);
        friendships.saveAndFlush(row);

        Friendship found = friendships.findById(row.getId()).orElseThrow();

        assertThat(found.getClosedBy()).isEqualTo(b.getId());
        assertThat(found.isRequestMasked()).isTrue();
    }

    @Test
    void reversedPair_violatesTheUniquePairIndex() {
        User a = user("a@example.com");
        User b = user("b@example.com");
        friendships.saveAndFlush(new Friendship(a, b, FriendshipStatus.PENDING, Instant.now()));

        // Stessa coppia con i ruoli invertiti: una riga per coppia, qualunque dei due abbia chiesto.
        assertThatThrownBy(() -> jdbc.update(
                "insert into friendships (requester_id, addressee_id, status, updated_at) "
                        + "values (?, ?, 'PENDING', now())", b.getId(), a.getId()))
                .hasMessageContaining("uq_friendships_pair");
    }

    @Test
    void selfFriendship_violatesTheCheckConstraint() {
        User a = user("a@example.com");

        assertThatThrownBy(() -> jdbc.update(
                "insert into friendships (requester_id, addressee_id, status, updated_at) "
                        + "values (?, ?, 'PENDING', now())", a.getId(), a.getId()))
                .hasMessageContaining("ck_friendships_not_self");
    }

    @Test
    void closedByWithoutDeclinedOrRemoved_violatesTheCheckConstraint() {
        User a = user("a@example.com");
        User b = user("b@example.com");
        Friendship pending = friendships.saveAndFlush(new Friendship(a, b, FriendshipStatus.PENDING, Instant.now()));
        Friendship other = friendships.saveAndFlush(
                new Friendship(user("c@example.com"), user("d@example.com"), FriendshipStatus.PENDING, Instant.now()));

        // closed_by su una richiesta ancora pendente.
        assertThatThrownBy(() -> jdbc.update("update friendships set closed_by = ? where id = ?",
                b.getId(), pending.getId())).hasMessageContaining("ck_friendships_closed_by");
        // DECLINED senza closed_by.
        assertThatThrownBy(() -> jdbc.update("update friendships set status = 'DECLINED' where id = ?",
                other.getId())).hasMessageContaining("ck_friendships_closed_by");
    }

    @Test
    void maskWithoutDeclined_violatesTheCheckConstraint() {
        User a = user("a@example.com");
        User b = user("b@example.com");
        Friendship pending = friendships.saveAndFlush(new Friendship(a, b, FriendshipStatus.PENDING, Instant.now()));

        assertThatThrownBy(() -> jdbc.update("update friendships set request_masked = true where id = ?",
                pending.getId())).hasMessageContaining("ck_friendships_masked");
    }

    @Test
    void unknownUser_isRejectedByTheDatabase() {
        User a = user("a@example.com");

        assertThatThrownBy(() -> jdbc.update(
                "insert into friendships (requester_id, addressee_id, status, updated_at) "
                        + "values (?, ?, 'PENDING', now())", a.getId(), UUID.randomUUID()))
                .hasMessageContaining("fk_friendships_addressee");
    }

    @Test
    void findForUpdate_findsThePairInEitherDirectionAndById() {
        User a = user("a@example.com");
        User b = user("b@example.com");
        User c = user("c@example.com");
        Friendship row = friendships.saveAndFlush(new Friendship(a, b, FriendshipStatus.PENDING, Instant.now()));

        transaction.executeWithoutResult(status -> {
            assertThat(friendships.findForUpdateByPair(a.getId(), b.getId())).map(Friendship::getId)
                    .contains(row.getId());
            assertThat(friendships.findForUpdateByPair(b.getId(), a.getId())).map(Friendship::getId)
                    .contains(row.getId());
            assertThat(friendships.findForUpdateByPair(a.getId(), c.getId())).isEmpty();
            assertThat(friendships.findForUpdateById(row.getId())).isPresent();
            assertThat(friendships.findForUpdateById(UUID.randomUUID())).isEmpty();
        });
    }

    private User user(String email) {
        User user = new User(email, "hash-di-prova", "Utente");
        user.setEmailVerified(true);
        return users.save(user);
    }
}

package it.epicode.resonance.auth;

import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Ciclo di vita dei refresh token: creazione, rotazione con finestra di 10 secondi, rilevamento del riuso,
 * scadenza, sospensione, revoca singola e totale e pulizia (progettazione, sezioni 4.2, 4.8 e 4.11).
 */
class RefreshTokenServiceTest extends IntegrationTest {

    @Autowired
    private RefreshTokenService service;

    @Autowired
    private RefreshTokenRepository tokens;

    @Autowired
    private UserRepository users;

    private User user;

    @BeforeEach
    void createUser() {
        // Istante senza frazioni di secondo: PostgreSQL salva i microsecondi e arrotonda, quindi con i nanosecondi
        // di Instant.now() la differenza tra due istanti letti dal database non sarebbe esatta e i test al bordo
        // della finestra di 10 secondi sarebbero instabili.
        clock.setInstant(clock.instant().truncatedTo(ChronoUnit.SECONDS));
        user = verifiedUser("mario@example.com");
    }

    @Test
    void create_storesOnlyTheHashOfA43CharactersValue() {
        IssuedRefreshToken issued = service.create(user.getId());

        assertThat(issued.value()).hasSize(43).matches("[A-Za-z0-9_-]+");
        RefreshToken row = tokens.findById(issued.id()).orElseThrow();
        assertThat(row.getTokenHash()).isEqualTo(RefreshTokenService.hash(issued.value())).hasSize(64);
        assertThat(row.getTokenHash()).doesNotContain(issued.value());
        assertThat(row.isRevoked()).isFalse();
        assertThat(row.getUserId()).isEqualTo(user.getId());
        assertThat(issued.toString()).doesNotContain(issued.value());
    }

    @Test
    void rotate_revokesOldTokenWithReplacedByAndIssuesNewOneWithTenFullDays() {
        IssuedRefreshToken first = service.create(user.getId());
        clock.advance(Duration.ofDays(3));

        RefreshOutcome outcome = service.rotate(first.value());

        assertThat(outcome).isInstanceOf(RefreshOutcome.Rotated.class);
        RefreshOutcome.Rotated rotated = (RefreshOutcome.Rotated) outcome;
        assertThat(rotated.userId()).isEqualTo(user.getId());
        RefreshToken old = tokens.findById(first.id()).orElseThrow();
        assertThat(old.isRevoked()).isTrue();
        assertThat(old.getReplacedBy()).isEqualTo(rotated.token().id());
        assertThat(old.getRevokedAt()).isCloseTo(clock.instant(), within(1, ChronoUnit.MILLIS));
        // Scadenza scorrevole: il nuovo token ha 10 giorni pieni a partire da adesso, non dal primo.
        RefreshToken fresh = tokens.findById(rotated.token().id()).orElseThrow();
        assertThat(fresh.isRevoked()).isFalse();
        assertThat(fresh.getExpiresAt()).isCloseTo(clock.instant().plus(Duration.ofDays(10)), within(1, ChronoUnit.MILLIS));
        assertThat(rotated.token().value()).isNotEqualTo(first.value());
    }

    @Test
    void rotate_tokenRotatedFiveSecondsAgo_isConflictWithoutAnyRevocation() {
        IssuedRefreshToken first = service.create(user.getId());
        RefreshOutcome.Rotated rotated = (RefreshOutcome.Rotated) service.rotate(first.value());
        clock.advance(Duration.ofSeconds(5));

        RefreshOutcome outcome = service.rotate(first.value());

        assertThat(outcome).isInstanceOf(RefreshOutcome.Conflict.class);
        // Il token nuovo, che il browser ha gia', resta valido e nessun altro e' stato revocato.
        assertThat(tokens.findById(rotated.token().id()).orElseThrow().isRevoked()).isFalse();
        assertThat(tokens.count()).isEqualTo(2);
    }

    @Test
    void rotate_tokenRotatedNineSecondsAgo_isStillConflict() {
        IssuedRefreshToken first = service.create(user.getId());
        service.rotate(first.value());
        clock.advance(Duration.ofSeconds(9));

        assertThat(service.rotate(first.value())).isInstanceOf(RefreshOutcome.Conflict.class);
    }

    @Test
    void rotate_tokenRotatedNineAndAHalfSecondsAgo_isStillConflict() {
        // Dentro la finestra ma vicino al bordo: una finestra di soli 9 secondi risponderebbe "riuso".
        IssuedRefreshToken first = service.create(user.getId());
        service.rotate(first.value());
        clock.advance(Duration.ofMillis(9500));

        assertThat(service.rotate(first.value())).isInstanceOf(RefreshOutcome.Conflict.class);
    }

    @Test
    void rotate_tokenRotatedTenAndAHalfSecondsAgo_isReuseAndRevokesEveryToken() {
        // Appena fuori dalla finestra: una finestra di 11 secondi risponderebbe "conflitto".
        IssuedRefreshToken first = service.create(user.getId());
        RefreshOutcome.Rotated rotated = (RefreshOutcome.Rotated) service.rotate(first.value());
        clock.advance(Duration.ofMillis(10500));

        assertRejected(service.rotate(first.value()), ErrorCode.REFRESH_TOKEN_REUSED, true);
        assertThat(tokens.findById(rotated.token().id()).orElseThrow().isRevoked()).isTrue();
    }

    @RepeatedTest(20)
    void rotate_twoTrulyConcurrentRequestsOnTheSameToken_exactlyOneRotatesAndTheOtherGetsConflict() throws Exception {
        // Il lock di riga (PESSIMISTIC_WRITE) serializza le due transazioni: la seconda trova il token gia' ruotato.
        // Senza lock entrambe leggerebbero un token valido e ruoterebbero tutte e due. Il clock non avanza, quindi
        // la seconda e' sempre dentro la finestra di tolleranza.
        IssuedRefreshToken first = service.create(user.getId());
        CyclicBarrier startTogether = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Callable<RefreshOutcome> attempt = () -> {
                startTogether.await(10, TimeUnit.SECONDS);
                return service.rotate(first.value());
            };
            Future<RefreshOutcome> a = pool.submit(attempt);
            Future<RefreshOutcome> b = pool.submit(attempt);

            List<RefreshOutcome> outcomes = List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS));

            assertThat(outcomes).filteredOn(o -> o instanceof RefreshOutcome.Rotated).hasSize(1);
            assertThat(outcomes).filteredOn(o -> o instanceof RefreshOutcome.Conflict).hasSize(1);
            // Il vecchio token e il nuovo: nessun terzo token, e solo il nuovo resta valido.
            assertThat(tokens.findAll()).hasSize(2).filteredOn(t -> !t.isRevoked()).hasSize(1);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void rotate_tokenRotatedElevenSecondsAgo_isReuseAndRevokesEveryToken() {
        IssuedRefreshToken first = service.create(user.getId());
        RefreshOutcome.Rotated rotated = (RefreshOutcome.Rotated) service.rotate(first.value());
        IssuedRefreshToken otherDevice = service.create(user.getId());
        clock.advance(Duration.ofSeconds(11));

        RefreshOutcome outcome = service.rotate(first.value());

        assertRejected(outcome, ErrorCode.REFRESH_TOKEN_REUSED, true);
        assertThat(tokens.findById(rotated.token().id()).orElseThrow().isRevoked()).isTrue();
        assertThat(tokens.findById(otherDevice.id()).orElseThrow().isRevoked()).isTrue();
        // Anche il token valido e' ormai inutilizzabile.
        assertRejected(service.rotate(rotated.token().value()), ErrorCode.REFRESH_TOKEN_REUSED, true);
    }

    @Test
    void rotate_tokenRevokedByLogout_isReuseAndRevokesEveryToken() {
        // Revocato senza replaced_by (logout): la finestra di tolleranza non si applica (sezione 4.8, passo 4).
        IssuedRefreshToken loggedOut = service.create(user.getId());
        IssuedRefreshToken other = service.create(user.getId());
        service.revoke(loggedOut.value());

        RefreshOutcome outcome = service.rotate(loggedOut.value());

        assertRejected(outcome, ErrorCode.REFRESH_TOKEN_REUSED, true);
        assertThat(tokens.findById(other.id()).orElseThrow().isRevoked()).isTrue();
    }

    @Test
    void rotate_expiredToken_isRejectedWithoutRevokingOthers() {
        IssuedRefreshToken expired = service.create(user.getId());
        clock.advance(Duration.ofDays(11));
        IssuedRefreshToken recent = service.create(user.getId());

        RefreshOutcome outcome = service.rotate(expired.value());

        assertRejected(outcome, ErrorCode.REFRESH_TOKEN_EXPIRED, true);
        assertThat(tokens.findById(recent.id()).orElseThrow().isRevoked()).isFalse();
    }

    @Test
    void rotate_unknownOrMissingValue_isInvalid() {
        assertRejected(service.rotate("valore-mai-emesso"), ErrorCode.REFRESH_TOKEN_INVALID, true);
        assertRejected(service.rotate(null), ErrorCode.REFRESH_TOKEN_INVALID, true);
        assertRejected(service.rotate("  "), ErrorCode.REFRESH_TOKEN_INVALID, true);
    }

    @Test
    void rotate_suspendedUser_isRejectedWithDetailsAndRevokesEveryToken() {
        IssuedRefreshToken first = service.create(user.getId());
        IssuedRefreshToken second = service.create(user.getId());
        Instant until = clock.instant().plus(Duration.ofDays(3)).truncatedTo(ChronoUnit.SECONDS);
        suspend(user, until);

        RefreshOutcome outcome = service.rotate(first.value());

        RefreshOutcome.Rejected rejected = assertRejected(outcome, ErrorCode.ACCOUNT_SUSPENDED, true);
        assertThat(rejected.details()).containsEntry("suspensionReason", "Linguaggio offensivo");
        assertThat(rejected.details().get("suspendedUntil")).isEqualTo(until);
        // La revoca totale e' salvata anche se l'esito e' un errore: il service non lancia.
        assertThat(tokens.findById(first.id()).orElseThrow().isRevoked()).isTrue();
        assertThat(tokens.findById(second.id()).orElseThrow().isRevoked()).isTrue();
    }

    @Test
    void rotate_suspensionWithoutEnd_hasNullSuspendedUntilInDetails() {
        IssuedRefreshToken first = service.create(user.getId());
        suspend(user, null);

        RefreshOutcome.Rejected rejected = assertRejected(service.rotate(first.value()), ErrorCode.ACCOUNT_SUSPENDED, true);

        assertThat(rejected.details()).containsKey("suspendedUntil");
        assertThat(rejected.details().get("suspendedUntil")).isNull();
    }

    @Test
    void rotate_suspensionExpired_reactivatesUserAndRotates() {
        IssuedRefreshToken first = service.create(user.getId());
        suspend(user, clock.instant().plus(Duration.ofDays(1)));
        clock.advance(Duration.ofDays(2));

        assertThat(service.rotate(first.value())).isInstanceOf(RefreshOutcome.Rotated.class);
        assertThat(users.findById(user.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Test
    void revoke_marksOnlyThatTokenAndIsIdempotent() {
        IssuedRefreshToken mine = service.create(user.getId());
        IssuedRefreshToken other = service.create(user.getId());

        service.revoke(mine.value());
        Instant firstRevocation = tokens.findById(mine.id()).orElseThrow().getRevokedAt();
        clock.advance(Duration.ofSeconds(30));
        service.revoke(mine.value());
        service.revoke("sconosciuto");
        service.revoke(null);

        RefreshToken row = tokens.findById(mine.id()).orElseThrow();
        assertThat(row.isRevoked()).isTrue();
        assertThat(row.getReplacedBy()).isNull();
        assertThat(row.getRevokedAt()).isEqualTo(firstRevocation);
        assertThat(tokens.findById(other.id()).orElseThrow().isRevoked()).isFalse();
    }

    @Test
    void revokeAll_revokesOnlyTheTokensOfThatUser() {
        User stranger = verifiedUser("luca@example.com");
        IssuedRefreshToken a = service.create(user.getId());
        IssuedRefreshToken b = service.create(user.getId());
        IssuedRefreshToken strangers = service.create(stranger.getId());

        service.revokeAll(user.getId());

        assertThat(tokens.findById(a.id()).orElseThrow().isRevoked()).isTrue();
        assertThat(tokens.findById(b.id()).orElseThrow().isRevoked()).isTrue();
        assertThat(tokens.findById(strangers.id()).orElseThrow().isRevoked()).isFalse();
    }

    @Test
    void deleteExpired_removesOnlyTokensExpiredForMoreThanADay() {
        IssuedRefreshToken old = service.create(user.getId());
        // Scade il giorno 10: dopo 11 giorni e 12 ore e' scaduto da oltre un giorno.
        clock.advance(Duration.ofDays(10).plusHours(12));
        IssuedRefreshToken justExpired = service.create(user.getId());
        clock.advance(Duration.ofDays(10).plusHours(1));
        IssuedRefreshToken valid = service.create(user.getId());

        service.deleteExpired();

        assertThat(tokens.findById(old.id())).isEmpty();
        assertThat(tokens.findById(justExpired.id())).isPresent();
        assertThat(tokens.findById(valid.id())).isPresent();
    }

    @Test
    void deleteExpired_deletesARotatedChainWithoutForeignKeyErrors() {
        // replaced_by punta a un altro token da cancellare: la FK ON DELETE SET NULL non deve bloccare la pulizia.
        IssuedRefreshToken first = service.create(user.getId());
        RefreshOutcome.Rotated rotated = (RefreshOutcome.Rotated) service.rotate(first.value());
        clock.advance(Duration.ofDays(30));

        service.deleteExpired();

        assertThat(tokens.findById(first.id())).isEmpty();
        assertThat(tokens.findById(rotated.token().id())).isEmpty();
        assertThat(tokens.count()).isZero();
    }

    private RefreshOutcome.Rejected assertRejected(RefreshOutcome outcome, ErrorCode code, boolean clearCookie) {
        assertThat(outcome).isInstanceOf(RefreshOutcome.Rejected.class);
        RefreshOutcome.Rejected rejected = (RefreshOutcome.Rejected) outcome;
        assertThat(rejected.code()).isEqualTo(code);
        assertThat(rejected.clearCookie()).isEqualTo(clearCookie);
        return rejected;
    }

    private User verifiedUser(String email) {
        User created = new User(email, "hash-di-prova", email.substring(0, email.indexOf('@')));
        created.setEmailVerified(true);
        return users.save(created);
    }

    private void suspend(User target, Instant until) {
        // La sospensione richiede un autore (ck_users_suspension e fk_users_suspended_by).
        User moderator = users.save(new User("admin" + UUID.randomUUID() + "@example.com", "hash-di-prova", "Admin " + UUID.randomUUID()));
        target.setStatus(UserStatus.SUSPENDED);
        target.setSuspendedAt(clock.instant());
        target.setSuspendedBy(moderator.getId());
        target.setSuspensionReason("Linguaggio offensivo");
        target.setSuspendedUntil(until);
        users.save(target);
    }
}

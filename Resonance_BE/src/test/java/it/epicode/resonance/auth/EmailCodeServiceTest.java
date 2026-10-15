package it.epicode.resonance.auth;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Codici email a 6 cifre: emissione con i limiti di invio, scadenza a 15 minuti, 5 tentativi atomici e
 * confronto (progettazione, sezioni 4.5 e 4.6). Il tempo si avanza con il {@code MutableClock}.
 */
class EmailCodeServiceTest extends IntegrationTest {

    private static final EmailCodePurpose VERIFICATION = EmailCodePurpose.EMAIL_VERIFICATION;

    @Autowired
    private EmailCodeService service;

    @Autowired
    private EmailCodeRepository codes;

    @Autowired
    private UserRepository users;

    private User user;

    @BeforeEach
    void createUser() {
        // Istante senza frazioni di secondo: PostgreSQL arrotonda ai microsecondi e i test ai bordi
        // delle finestre (60 s, 15 min, 24 h) sarebbero instabili.
        clock.setInstant(clock.instant().truncatedTo(ChronoUnit.SECONDS));
        user = users.save(new User("mario@example.com", "hash-di-prova", "Mario"));
    }

    @Test
    void issue_returnsSixDigitCodeAndStoresItWithZeroAttempts() {
        String code = service.issue(user.getId(), VERIFICATION);

        assertThat(code).matches("\\d{6}");
        EmailCode row = codes.findByUserIdAndPurpose(user.getId(), VERIFICATION).orElseThrow();
        assertThat(row.getCode()).isEqualTo(code);
        assertThat(row.getAttempts()).isZero();
        assertThat(row.getSendsCount()).isEqualTo(1);
        assertThat(row.getSentAt()).isEqualTo(clock.instant());
    }

    @Test
    void issue_replacesThePreviousCodeAndResetsAttempts() {
        service.issue(user.getId(), VERIFICATION);
        String wrong = "000000".equals(codeOf(VERIFICATION)) ? "111111" : "000000";
        assertThatThrownBy(() -> service.verify(user.getId(), VERIFICATION, wrong))
                .isInstanceOf(AppException.class);
        assertThat(codes.findByUserIdAndPurpose(user.getId(), VERIFICATION).orElseThrow().getAttempts()).isEqualTo(1);

        clock.advance(Duration.ofSeconds(61));
        String second = service.issue(user.getId(), VERIFICATION);

        EmailCode row = codes.findByUserIdAndPurpose(user.getId(), VERIFICATION).orElseThrow();
        assertThat(row.getCode()).isEqualTo(second);
        assertThat(row.getAttempts()).isZero();
        assertThat(row.getSendsCount()).isEqualTo(2);
        assertThat(codes.count()).isEqualTo(1);
    }

    @Test
    void issue_keepsSeparateRowsPerPurpose() {
        service.issue(user.getId(), VERIFICATION);
        // Il limite dei 60 secondi vale per scopo: un codice di reset subito dopo è ammesso.
        service.issue(user.getId(), EmailCodePurpose.PASSWORD_RESET);

        assertThat(codes.count()).isEqualTo(2);
    }

    @Test
    void verify_withTheRightCodeSucceeds() {
        String code = service.issue(user.getId(), VERIFICATION);

        assertThatCode(() -> service.verify(user.getId(), VERIFICATION, code)).doesNotThrowAnyException();
    }

    @Test
    void verify_withAWrongCodeFailsWithCodeInvalidAndConsumesAnAttempt() {
        String code = service.issue(user.getId(), VERIFICATION);

        assertThatThrownBy(() -> service.verify(user.getId(), VERIFICATION, otherThan(code)))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.CODE_INVALID));

        // Il tentativo resta salvato anche se la verifica è fallita (noRollbackFor).
        assertThat(codes.findByUserIdAndPurpose(user.getId(), VERIFICATION).orElseThrow().getAttempts()).isEqualTo(1);
    }

    @Test
    void verify_afterFifteenMinutesAndOneSecond_failsWithCodeExpired() {
        String code = service.issue(user.getId(), VERIFICATION);

        clock.advance(Duration.ofMinutes(15).plusSeconds(1));

        assertThatThrownBy(() -> service.verify(user.getId(), VERIFICATION, code))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.CODE_EXPIRED));
    }

    @Test
    void verify_atExactlyFifteenMinutes_stillWorks() {
        String code = service.issue(user.getId(), VERIFICATION);

        clock.advance(Duration.ofMinutes(15));

        assertThatCode(() -> service.verify(user.getId(), VERIFICATION, code)).doesNotThrowAnyException();
    }

    @Test
    void verify_afterFiveWrongAttempts_evenTheRightCodeIsExpired() {
        String code = service.issue(user.getId(), VERIFICATION);
        String wrong = otherThan(code);
        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> service.verify(user.getId(), VERIFICATION, wrong))
                    .isInstanceOfSatisfying(AppException.class,
                            e -> assertThat(e.getCode()).isEqualTo(ErrorCode.CODE_INVALID));
        }

        assertThatThrownBy(() -> service.verify(user.getId(), VERIFICATION, code))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.CODE_EXPIRED));
        // Il sesto tentativo non è stato contato: il contatore si ferma a 5.
        assertThat(codes.findByUserIdAndPurpose(user.getId(), VERIFICATION).orElseThrow().getAttempts()).isEqualTo(5);
    }

    @Test
    void verify_withManyConcurrentWrongCodes_neverConsumesMoreThanFiveAttempts() throws Exception {
        // L'UPDATE atomico "attempts < 5" e' l'unica difesa quando molte richieste leggono insieme lo stesso
        // contatore: senza la condizione nello statement tutte le richieste parallele passerebbero e il limite
        // dei 5 tentativi si aggirerebbe con un attacco in parallelo.
        String code = service.issue(user.getId(), VERIFICATION);
        String wrong = otherThan(code);
        int requests = 20;
        CyclicBarrier startTogether = new CyclicBarrier(requests);
        ExecutorService pool = Executors.newFixedThreadPool(requests);
        try {
            List<Future<ErrorCode>> results = new ArrayList<>();
            for (int i = 0; i < requests; i++) {
                results.add(pool.submit(() -> {
                    startTogether.await(10, TimeUnit.SECONDS);
                    try {
                        service.verify(user.getId(), VERIFICATION, wrong);
                        return null;
                    } catch (AppException e) {
                        return e.getCode();
                    }
                }));
            }
            List<ErrorCode> outcomes = new ArrayList<>();
            for (Future<ErrorCode> result : results) {
                outcomes.add(result.get(30, TimeUnit.SECONDS));
            }

            assertThat(outcomes).filteredOn(c -> c == ErrorCode.CODE_INVALID).hasSize(5);
            assertThat(outcomes).filteredOn(c -> c == ErrorCode.CODE_EXPIRED).hasSize(requests - 5);
            assertThat(codes.findByUserIdAndPurpose(user.getId(), VERIFICATION).orElseThrow().getAttempts())
                    .isEqualTo(5);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void verify_withoutAnyCode_failsWithCodeExpired() {
        assertThatThrownBy(() -> service.verify(user.getId(), VERIFICATION, "123456"))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.CODE_EXPIRED));
    }

    @Test
    void invalidate_removesTheActiveCodeButKeepsTheSendCounters() {
        String code = service.issue(user.getId(), VERIFICATION);

        service.invalidate(user.getId(), VERIFICATION);

        assertThatThrownBy(() -> service.verify(user.getId(), VERIFICATION, code))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.CODE_EXPIRED));
        EmailCode row = codes.findByUserIdAndPurpose(user.getId(), VERIFICATION).orElseThrow();
        assertThat(row.getCode()).isNull();
        // I contatori dei limiti restano: un codice usato non azzera la protezione dagli invii a raffica.
        assertThat(row.getSendsCount()).isEqualTo(1);
        assertThat(row.getSentAt()).isNotNull();
    }

    @Test
    void issue_secondSendWithinSixtySeconds_failsWithTooManyRequests() {
        service.issue(user.getId(), VERIFICATION);
        clock.advance(Duration.ofSeconds(59));

        assertThatThrownBy(() -> service.issue(user.getId(), VERIFICATION))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.TOO_MANY_REQUESTS));
    }

    @Test
    void issue_afterSixtySeconds_isAllowed() {
        service.issue(user.getId(), VERIFICATION);
        clock.advance(Duration.ofSeconds(60));

        assertThatCode(() -> service.issue(user.getId(), VERIFICATION)).doesNotThrowAnyException();
    }

    @Test
    void issue_sixthSendWithinTwentyFourHours_failsWithTooManyRequests() {
        for (int i = 0; i < 5; i++) {
            service.issue(user.getId(), VERIFICATION);
            clock.advance(Duration.ofMinutes(2));
        }

        assertThatThrownBy(() -> service.issue(user.getId(), VERIFICATION))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.TOO_MANY_REQUESTS));
    }

    @Test
    void issue_afterTwentyFourHours_isAllowedAgainAndTheWindowRestarts() {
        for (int i = 0; i < 5; i++) {
            service.issue(user.getId(), VERIFICATION);
            clock.advance(Duration.ofMinutes(2));
        }
        // La finestra di 24 ore è partita al primo invio.
        clock.advance(Duration.ofHours(24));

        assertThatCode(() -> service.issue(user.getId(), VERIFICATION)).doesNotThrowAnyException();
        assertThat(codes.findByUserIdAndPurpose(user.getId(), VERIFICATION).orElseThrow().getSendsCount()).isEqualTo(1);
    }

    @Test
    void verify_comparesCodesOnlyWhenTheyHaveTheSameLength() {
        String code = service.issue(user.getId(), VERIFICATION);

        // Un valore più corto o più lungo del codice è semplicemente sbagliato, senza eccezioni strane.
        assertThatThrownBy(() -> service.verify(user.getId(), VERIFICATION, code.substring(0, 5)))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.CODE_INVALID));
    }

    private String codeOf(EmailCodePurpose purpose) {
        return codes.findByUserIdAndPurpose(user.getId(), purpose).orElseThrow().getCode();
    }

    private static String otherThan(String code) {
        return "000000".equals(code) ? "111111" : "000000";
    }
}

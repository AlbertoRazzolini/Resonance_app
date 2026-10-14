package it.epicode.resonance.auth;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Codici email a 6 cifre (progettazione, sezioni 4.5 e 4.6): emissione con i limiti di invio, verifica con
 * scadenza, tentativi consumati prima del confronto e confronto a tempo costante. Il service non controlla
 * utente, stato o password: lo fa chi lo chiama, che deve avere gia' il lock sulla riga dell'utente.
 */
@Service
public class EmailCodeService {

    private static final Duration VALIDITY = Duration.ofMinutes(15);
    private static final int MAX_ATTEMPTS = 5;
    private static final Duration MIN_SEND_INTERVAL = Duration.ofSeconds(60);
    private static final Duration SEND_WINDOW = Duration.ofHours(24);
    private static final int MAX_SENDS_PER_WINDOW = 5;

    private final EmailCodeRepository codes;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public EmailCodeService(EmailCodeRepository codes, Clock clock) {
        this.codes = codes;
        this.clock = clock;
    }

    /**
     * Emette un codice nuovo per l'utente e lo scopo e lo restituisce. Sostituisce quello precedente e azzera i
     * tentativi. Applica i limiti della sezione 4.6: un invio ogni 60 secondi e cinque ogni 24 ore, altrimenti 429.
     */
    @Transactional
    public String issue(UUID userId, EmailCodePurpose purpose) {
        Instant now = clock.instant();
        EmailCode row = codes.findWithLockByUserIdAndPurpose(userId, purpose)
                .orElseGet(() -> new EmailCode(userId, purpose));
        checkSendLimits(row, now);

        // La finestra di 24 ore riparte quando e' trascorsa, e con lei il conteggio degli invii.
        if (row.getSendsWindowStart() == null || !now.isBefore(row.getSendsWindowStart().plus(SEND_WINDOW))) {
            row.setSendsWindowStart(now);
            row.setSendsCount(0);
        }
        String code = "%06d".formatted(random.nextInt(1_000_000));
        row.setCode(code);
        row.setSentAt(now);
        row.setAttempts(0);
        row.setSendsCount(row.getSendsCount() + 1);
        // saveAndFlush: due prime emissioni parallele sulla stessa coppia fanno scattare uq_email_codes_user_purpose.
        codes.saveAndFlush(row);
        return code;
    }

    /**
     * Verifica il codice ricevuto (progettazione, sezione 4.5, passi 4-6). Assente, oltre i 15 minuti o con 5
     * tentativi usati: CODE_EXPIRED. Il tentativo si consuma con un UPDATE atomico PRIMA del confronto, che e'
     * a tempo costante: sbagliato e' CODE_INVALID. noRollbackFor: il tentativo consumato resta salvato anche
     * quando la verifica fallisce, altrimenti il limite dei 5 tentativi si aggirerebbe. Non cancella il
     * codice: lo fa {@link #invalidate} quando l'operazione che lo richiede e' riuscita.
     */
    @Transactional(noRollbackFor = AppException.class)
    public void verify(UUID userId, EmailCodePurpose purpose, String received) {
        Instant now = clock.instant();
        EmailCode row = codes.findByUserIdAndPurpose(userId, purpose)
                .filter(candidate -> isUsable(candidate, now))
                .orElseThrow(EmailCodeService::expired);
        if (codes.consumeAttempt(row.getId(), MAX_ATTEMPTS) == 0) {
            throw expired();
        }
        // Il codice letto prima dell'UPDATE e' ancora quello giusto: sulla riga lavora una transazione alla volta
        // per chi chiama (lock sull'utente) e un nuovo invio azzera comunque i tentativi.
        boolean same = received != null && MessageDigest.isEqual(
                row.getCode().getBytes(StandardCharsets.UTF_8), received.getBytes(StandardCharsets.UTF_8));
        if (!same) {
            throw new AppException(ErrorCode.CODE_INVALID, "Codice non valido");
        }
    }

    /**
     * Toglie il codice attivo dopo l'uso. I contatori degli invii restano, cosi' i limiti non si azzerano.
     */
    @Transactional
    public void invalidate(UUID userId, EmailCodePurpose purpose) {
        codes.clearCode(userId, purpose);
    }

    /**
     * Utilizzabile = presente, entro i 15 minuti dall'invio e con meno di 5 tentativi usati.
     */
    private static boolean isUsable(EmailCode row, Instant now) {
        return row.getCode() != null
                && !now.isAfter(row.getSentAt().plus(VALIDITY))
                && row.getAttempts() < MAX_ATTEMPTS;
    }

    private static void checkSendLimits(EmailCode row, Instant now) {
        boolean tooSoon = row.getSentAt() != null && now.isBefore(row.getSentAt().plus(MIN_SEND_INTERVAL));
        boolean windowOpen = row.getSendsWindowStart() != null && now.isBefore(row.getSendsWindowStart().plus(SEND_WINDOW));
        if (tooSoon || (windowOpen && row.getSendsCount() >= MAX_SENDS_PER_WINDOW)) {
            throw new AppException(ErrorCode.TOO_MANY_REQUESTS, "Troppi invii del codice: riprova più tardi");
        }
    }

    private static AppException expired() {
        return new AppException(ErrorCode.CODE_EXPIRED, "Codice scaduto: richiedine uno nuovo");
    }
}

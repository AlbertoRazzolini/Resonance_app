package it.epicode.resonance.auth;

import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Ciclo di vita dei refresh token (progettazione, sezioni 4.2, 4.8 e 4.11): creazione, rotazione con
 * finestra di tolleranza e rilevamento del riuso, revoca singola e totale, pulizia degli scaduti.
 */
@Service
public class RefreshTokenService {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);

    private final RefreshTokenRepository tokens;
    private final UserRepository users;
    private final UserAccessService userAccess;
    private final Clock clock;
    private final Duration ttl;
    private final Duration grace;
    private final SecureRandom random = new SecureRandom();

    public RefreshTokenService(RefreshTokenRepository tokens, UserRepository users, UserAccessService userAccess,
                               Clock clock,
                               @Value("${app.auth.refresh-token-ttl}") Duration ttl,
                               @Value("${app.auth.refresh-grace}") Duration grace) {
        this.tokens = tokens;
        this.users = users;
        this.userAccess = userAccess;
        this.clock = clock;
        this.ttl = ttl;
        this.grace = grace;
    }

    /**
     * Crea un token nuovo per l'utente: 32 byte casuali in base64url (43 caratteri); si salva solo l'hash.
     */
    @Transactional
    public IssuedRefreshToken create(UUID userId) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String value = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expiresAt = clock.instant().plus(ttl);
        RefreshToken saved = tokens.save(new RefreshToken(userId, hash(value), expiresAt));
        return new IssuedRefreshToken(saved.getId(), value, expiresAt);
    }

    /**
     * Ruota il token presentato (progettazione, sezione 4.8, passi 3-7). Non lancia: restituisce un
     * esito, cosi' la transazione si chiude con commit e le revoche totali restano salvate. Ordine dei lock
     * sempre utente -> token, come reset e sospensione: il reset della password non puo' concludersi in mezzo a
     * una rotazione e lasciare valido il token nuovo (progettazione, sezione 4.8; decisione 76, S1).
     */
    @Transactional
    public RefreshOutcome rotate(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return invalid();
        }
        String tokenHash = hash(rawValue);
        // Prima l'utente, senza lock e senza caricare il token (si rileggerebbe vecchio dopo l'attesa del lock).
        Optional<UUID> owner = tokens.findUserIdByTokenHash(tokenHash);
        if (owner.isEmpty()) {
            return invalid();
        }
        users.findWithLockById(owner.get());
        // Ora il token, con il lock di sempre: due refresh con lo stesso cookie si serializzano qui.
        Optional<RefreshToken> found = tokens.findWithLockByTokenHash(tokenHash);
        if (found.isEmpty()) {
            return invalid();
        }
        RefreshToken token = found.get();
        Instant now = clock.instant();

        if (token.isRevoked()) {
            // Sostituito da pochissimo: e' il secondo di due refresh concorrenti (due schede) e il browser ha
            // gia' il cookie nuovo. Niente token, niente revoche, cookie intatto.
            if (token.getReplacedBy() != null && !now.isAfter(token.getRevokedAt().plus(grace))) {
                return new RefreshOutcome.Conflict();
            }
            // Altrimenti qualcuno presenta un token gia' usato o scollegato: si revoca tutto.
            revokeAll(token.getUserId());
            log.warn("Riuso di un refresh token revocato: revocati tutti i token dell'utente {}", token.getUserId());
            return new RefreshOutcome.Rejected(ErrorCode.REFRESH_TOKEN_REUSED, true, null);
        }
        if (!token.getExpiresAt().isAfter(now)) {
            return new RefreshOutcome.Rejected(ErrorCode.REFRESH_TOKEN_EXPIRED, true, null);
        }

        UserAccess access = userAccess.resolve(token.getUserId());
        if (!access.isActive()) {
            revokeAll(token.getUserId());
            if (access.status() == AccessStatus.SUSPENDED) {
                Map<String, Object> details = new LinkedHashMap<>();
                details.put("suspensionReason", access.suspensionReason());
                details.put("suspendedUntil", access.suspendedUntil());
                return new RefreshOutcome.Rejected(ErrorCode.ACCOUNT_SUSPENDED, true, details);
            }
            return invalid();
        }

        IssuedRefreshToken next = create(token.getUserId());
        token.setRevoked(true);
        token.setRevokedAt(now);
        token.setReplacedBy(next.id());
        tokens.save(token);
        return new RefreshOutcome.Rotated(token.getUserId(), next);
    }

    /**
     * Revoca il token del dispositivo (logout), senza replaced_by. Idempotente: valore assente,
     * sconosciuto o gia' revocato non hanno effetto.
     */
    @Transactional
    public void revoke(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return;
        }
        tokens.findWithLockByTokenHash(hash(rawValue))
                .filter(token -> !token.isRevoked())
                .ifPresent(token -> {
                    token.setRevoked(true);
                    token.setRevokedAt(clock.instant());
                    tokens.save(token);
                });
    }

    /**
     * Revoca tutti i token dell'utente (reset password, sospensione, riuso; progettazione, sezione 4.11).
     */
    @Transactional
    public void revokeAll(UUID userId) {
        tokens.revokeAllByUserId(userId, clock.instant());
    }

    /**
     * Cancella i token scaduti da piu' di un giorno. Usa fixedDelay, che parte anche all'avvio, perche'
     * su Render il servizio gratuito si sospende (progettazione, sezione 4.11).
     */
    @Scheduled(fixedDelay = 24, timeUnit = TimeUnit.HOURS)
    @Transactional
    public void deleteExpired() {
        tokens.deleteByExpiresAtBefore(clock.instant().minus(Duration.ofDays(1)));
    }

    private static RefreshOutcome.Rejected invalid() {
        return new RefreshOutcome.Rejected(ErrorCode.REFRESH_TOKEN_INVALID, true, null);
    }

    /**
     * SHA-256 esadecimale: il token ha 256 bit di entropia, quindi un hash veloce basta (sezione 4.2).
     */
    static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 non disponibile", e);
        }
    }
}

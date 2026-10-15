package it.epicode.resonance.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import it.epicode.resonance.support.MutableClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Emissione e lettura dell'access token (progettazione, sezione 4.1): solo sub, iat ed exp,
 * firma HS256, e nessun token anomalo viene accettato. Test unitario, senza database.
 */
class AccessTokenServiceTest {

    private static final String SECRET = "unit-test-secret-with-at-least-32-bytes-0123456789";
    private static final Duration TTL = Duration.ofMinutes(15);

    private MutableClock clock;
    private AccessTokenService service;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-10-14T10:00:00.123Z"));
        service = new AccessTokenService(clock, SECRET, TTL);
    }

    @Test
    void issueAndParse_returnsUserIdAndExpiry() {
        UUID userId = UUID.randomUUID();

        IssuedAccessToken issued = service.issue(userId);

        // La scadenza e' troncata ai secondi, come nel JWT, cosi' coincide con quella riletta.
        assertThat(issued.expiresAt()).isEqualTo(Instant.parse("2026-10-14T10:15:00Z"));
        assertThat(service.parse(issued.token()))
                .hasValueSatisfying(claims -> {
                    assertThat(claims.userId()).isEqualTo(userId);
                    assertThat(claims.expiresAt()).isEqualTo(issued.expiresAt());
                });
    }

    @Test
    void parse_rejectsTokenAfterExpiry() {
        IssuedAccessToken issued = service.issue(UUID.randomUUID());

        clock.advance(Duration.ofMinutes(16));

        assertThat(service.parse(issued.token())).isEmpty();
    }

    @Test
    void parse_rejectsTokenSignedWithAnotherSecret() {
        AccessTokenService other = new AccessTokenService(clock, "another-secret-with-at-least-32-bytes-9876543210", TTL);

        assertThat(service.parse(other.issue(UUID.randomUUID()).token())).isEmpty();
    }

    @Test
    void parse_rejectsMalformedTokens() {
        assertThat(service.parse("non-un-jwt")).isEmpty();
        assertThat(service.parse("")).isEmpty();
        assertThat(service.parse("a.b.c")).isEmpty();
    }

    @Test
    void parse_rejectsSubjectThatIsNotAUuid() {
        String token = signedWith(SECRET, Jwts.SIG.HS256, "not-a-uuid");

        assertThat(service.parse(token)).isEmpty();
    }

    @Test
    void parse_rejectsOtherSignatureAlgorithms() {
        // Stessa chiave ma HS384: l'algoritmo e' fissato a HS256 (progettazione, sezione 4.1).
        String token = signedWith(SECRET, Jwts.SIG.HS384, UUID.randomUUID().toString());

        assertThat(service.parse(token)).isEmpty();
    }

    @Test
    void parse_rejectsHs512Token() {
        // HS512 vuole una chiave di almeno 64 byte: il servizio usa un segreto lungo, cosi' la firma e'
        // valida e l'unico motivo del rifiuto e' l'algoritmo.
        String longSecret = "s".repeat(64);
        AccessTokenService longKeyService = new AccessTokenService(clock, longSecret, TTL);
        String token = signedWith(longSecret, Jwts.SIG.HS512, UUID.randomUUID().toString());

        assertThat(longKeyService.parse(token)).isEmpty();
    }

    @Test
    void parse_rejectsUnsignedTokenWithAlgNone() {
        // Attacco classico: JWT senza firma ("alg":"none") con un sub valido.
        Instant now = clock.instant();
        String token = Jwts.builder()
                .subject(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(TTL)))
                .compact();

        assertThat(token.split("\\.")).hasSize(2);
        assertThat(service.parse(token)).isEmpty();
        // Anche con il separatore della firma ma vuota.
        assertThat(service.parse(token + ".")).isEmpty();
    }

    @Test
    void issue_putsOnlySubIatAndExpInThePayload() {
        UUID userId = UUID.randomUUID();

        String token = service.issue(userId).token();
        String payload = new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]), StandardCharsets.UTF_8);

        // Nessun ruolo e nessuno stato: si leggono sempre dal database (progettazione, sezione 5.2).
        assertThat(payload).contains("\"sub\":\"" + userId + "\"", "\"iat\":", "\"exp\":");
        assertThat(payload.split(",")).hasSize(3);
    }

    @Test
    void constructor_rejectsSecretShorterThan32Bytes() {
        assertThatThrownBy(() -> new AccessTokenService(clock, "troppo-corto", TTL))
                .isInstanceOf(RuntimeException.class);
    }

    private String signedWith(String secret, io.jsonwebtoken.security.MacAlgorithm algorithm, String subject) {
        SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        Instant now = clock.instant();
        return Jwts.builder()
                .subject(subject)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(TTL)))
                .signWith(key, algorithm)
                .compact();
    }
}

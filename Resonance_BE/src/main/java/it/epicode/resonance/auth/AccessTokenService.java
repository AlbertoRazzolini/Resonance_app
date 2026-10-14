package it.epicode.resonance.auth;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

/**
 * Emette e legge gli access token (progettazione, sezione 4.1): JWT HS256 con i soli claim sub, iat
 * ed exp. Non c'e' nessuna tabella e nessuna revoca: il token vale 15 minuti e ruoli e stato si
 * leggono dal database a ogni richiesta (sezioni 5.2 e 8.10).
 */
@Service
public class AccessTokenService {

    private final Clock clock;
    private final SecretKey key;
    private final Duration ttl;

    public AccessTokenService(Clock clock,
                              @Value("${app.jwt.secret}") String secret,
                              @Value("${app.auth.access-token-ttl}") Duration ttl) {
        this.clock = clock;
        // HS256 vuole almeno 32 byte: con un segreto piu' corto l'applicazione non parte (WeakKeyException).
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttl = ttl;
    }

    /**
     * Emette un access token per l'utente. L'algoritmo e' fissato a HS256: senza, jjwt lo
     * sceglierebbe dalla lunghezza del segreto.
     */
    public IssuedAccessToken issue(UUID userId) {
        // Nel JWT le date sono in secondi: si tronca qui, cosi' la scadenza restituita coincide con quella nel token.
        Instant now = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        Instant expiresAt = now.plus(ttl);
        String token = Jwts.builder()
                .subject(userId.toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiresAt))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
        return new IssuedAccessToken(token, expiresAt);
    }

    /**
     * Legge un token. Firma errata, algoritmo diverso da HS256, scaduto, malformato o con un sub che
     * non e' un UUID: Optional vuoto. Decide chi chiama se e' un 401 (il filtro non lo decide mai).
     */
    public Optional<AccessTokenClaims> parse(String token) {
        try {
            var jws = Jwts.parser()
                    .verifyWith(key)
                    .clock(() -> Date.from(clock.instant()))
                    .build()
                    .parseSignedClaims(token);
            // verifyWith accetta anche HS384 e HS512 con la stessa chiave: qui si impone HS256.
            if (!Jwts.SIG.HS256.getId().equals(jws.getHeader().getAlgorithm())) {
                return Optional.empty();
            }
            var claims = jws.getPayload();
            return Optional.of(new AccessTokenClaims(
                    UUID.fromString(claims.getSubject()),
                    claims.getExpiration().toInstant()));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}

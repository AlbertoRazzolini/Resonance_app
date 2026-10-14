package it.epicode.resonance.auth;

import it.epicode.resonance.auth.dto.LoginRequest;
import it.epicode.resonance.auth.dto.LoginResponse;
import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.RateLimit;
import it.epicode.resonance.common.RateLimitService;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.dto.MeResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Login, apertura della sessione (access token + refresh token) e logout (progettazione, sezioni 4.7-4.9).
 * La rotazione del refresh e' in {@link RefreshTokenService}; qui si costruisce la risposta.
 */
@Service
public class AuthService {

    // BCrypt legge al massimo 72 byte: oltre, la password non puo' essere quella registrata (sezione 4.4).
    private static final int MAX_PASSWORD_BYTES = 72;

    private final UserRepository users;
    private final UserRoleRepository userRoles;
    private final UserAccessService userAccess;
    private final PasswordEncoder passwordEncoder;
    private final RateLimitService rateLimits;
    private final AccessTokenService accessTokens;
    private final RefreshTokenService refreshTokens;

    // Hash di una stringa casuale calcolato all'avvio con lo stesso encoder (stesso costo) dei veri: serve solo a
    // far durare allo stesso modo il login di un'email sconosciuta. Nessuna password reale lo corrisponde.
    private final String dummyHash;

    public AuthService(UserRepository users, UserRoleRepository userRoles, UserAccessService userAccess,
                       PasswordEncoder passwordEncoder, RateLimitService rateLimits,
                       AccessTokenService accessTokens, RefreshTokenService refreshTokens) {
        this.users = users;
        this.userRoles = userRoles;
        this.userAccess = userAccess;
        this.passwordEncoder = passwordEncoder;
        this.rateLimits = rateLimits;
        this.accessTokens = accessTokens;
        this.refreshTokens = refreshTokens;
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    /**
     * Login nell'ordine di NoseY (progettazione, sezione 4.7): limite dei fallimenti, credenziali, e solo con
     * la password giusta email verificata e sospensione, cosi' questi due controlli non rivelano quali email
     * esistono. Il limite e' in memoria: il rollback di un errore non annulla i fallimenti registrati.
     */
    @Transactional
    public AuthSession login(LoginRequest request) {
        String email = request.email();
        rateLimits.check(RateLimit.LOGIN_FAILED, email);

        // Email sconosciuta: si confronta comunque con un hash fittizio, dello stesso costo di quelli veri, cosi'
        // il tempo di risposta non rivela se l'email esiste (decisione 48). Il risultato si scarta.
        Optional<User> found = users.findByEmail(email);
        boolean passwordCorrect = passwordMatches(request.password(),
                found.map(User::getPasswordHash).orElse(dummyHash));
        User user = found.filter(candidate -> passwordCorrect).orElse(null);
        if (user == null) {
            // Utente inesistente e password errata: stessa risposta, e il fallimento conta in entrambi i casi.
            rateLimits.record(RateLimit.LOGIN_FAILED, email);
            throw new AppException(ErrorCode.INVALID_CREDENTIALS, "Email o password errate");
        }

        // resolve applica anche la riattivazione pigra: una sospensione scaduta lascia entrare l'utente.
        UserAccess access = userAccess.resolve(user.getId());
        switch (access.status()) {
            case NOT_VERIFIED -> throw new AppException(ErrorCode.EMAIL_NOT_VERIFIED, "Email non ancora verificata");
            case SUSPENDED -> throw suspended(access);
            case NOT_FOUND -> throw new AppException(ErrorCode.INVALID_CREDENTIALS, "Email o password errate");
            case ACTIVE -> { }
        }

        rateLimits.reset(RateLimit.LOGIN_FAILED, email);
        return openSession(user.getId(), refreshTokens.create(user.getId()));
    }

    /**
     * Ruota il refresh token del cookie (progettazione, sezione 4.8). Restituisce l'esito invece di lanciare,
     * perche' le revoche totali devono restare salvate anche quando la richiesta finisce con un errore.
     */
    public RefreshOutcome refresh(String refreshTokenValue) {
        return refreshTokens.rotate(refreshTokenValue);
    }

    /**
     * Costruisce la sessione per un utente che ha appena ottenuto un refresh token (login o rotazione):
     * access token nuovo e profilo riletto dal database, con i ruoli attuali.
     */
    @Transactional
    public AuthSession openSession(UUID userId, IssuedRefreshToken refreshToken) {
        // Rilettura dopo l'eventuale riattivazione pigra, che svuota il contesto di persistenza.
        User user = users.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_CREDENTIALS, "Email o password errate"));
        Set<Role> roles = userRoles.findRolesByUserId(userId);
        IssuedAccessToken accessToken = accessTokens.issue(userId);
        LoginResponse response = new LoginResponse(accessToken.token(), accessToken.expiresAt(),
                MeResponse.from(user, roles));
        return new AuthSession(response, refreshToken.value());
    }

    /**
     * Logout del dispositivo (progettazione, sezione 4.9): revoca il solo refresh token del cookie, se valido.
     * Idempotente e senza Bearer: funziona anche con l'access token scaduto.
     */
    @Transactional
    public void logout(String refreshTokenValue) {
        refreshTokens.revoke(refreshTokenValue);
    }

    private boolean passwordMatches(String password, String hash) {
        // Oltre 72 byte si risponde come per una password errata, senza chiamare BCrypt (review focus 2).
        return password.getBytes(StandardCharsets.UTF_8).length <= MAX_PASSWORD_BYTES
                && passwordEncoder.matches(password, hash);
    }

    private AppException suspended(UserAccess access) {
        // Il valore null e' ammesso: suspendedUntil e' nullo per una sospensione a tempo indeterminato.
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("suspensionReason", access.suspensionReason());
        details.put("suspendedUntil", access.suspendedUntil());
        return new AppException(ErrorCode.ACCOUNT_SUSPENDED, "Account sospeso").withDetails(details);
    }
}

package it.epicode.resonance.auth;

import it.epicode.resonance.auth.dto.EmailRequest;
import it.epicode.resonance.auth.dto.LoginRequest;
import it.epicode.resonance.auth.dto.LoginResponse;
import it.epicode.resonance.auth.dto.RegisterRequest;
import it.epicode.resonance.auth.dto.RegisterResponse;
import it.epicode.resonance.auth.dto.ResetPasswordRequest;
import it.epicode.resonance.auth.dto.VerifyRequest;
import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.RateLimit;
import it.epicode.resonance.common.RateLimitService;
import it.epicode.resonance.mail.PasswordChangedEmailEvent;
import it.epicode.resonance.mail.PasswordResetCodeEmailEvent;
import it.epicode.resonance.mail.VerificationCodeEmailEvent;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import it.epicode.resonance.user.dto.MeResponse;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Registrazione, verifica dell'email, reinvio del codice, login, apertura della sessione (access token +
 * refresh token), logout e reset della password (progettazione, sezioni 4.4-4.10). La rotazione del refresh e' in
 * {@link RefreshTokenService}, i codici email in {@link EmailCodeService}; qui si costruisce la risposta.
 */
@Service
public class AuthService {

    private final UserRepository users;
    private final UserRoleRepository userRoles;
    private final UserAccessService userAccess;
    private final PasswordEncoder passwordEncoder;
    private final RateLimitService rateLimits;
    private final AccessTokenService accessTokens;
    private final RefreshTokenService refreshTokens;
    private final EmailCodeService emailCodes;
    private final ApplicationEventPublisher events;

    // Hash di una stringa casuale calcolato all'avvio con lo stesso encoder (stesso costo) dei veri: serve solo a
    // far durare allo stesso modo il login di un'email sconosciuta. Nessuna password reale lo corrisponde.
    private final String dummyHash;

    public AuthService(UserRepository users, UserRoleRepository userRoles, UserAccessService userAccess,
                       PasswordEncoder passwordEncoder, RateLimitService rateLimits,
                       AccessTokenService accessTokens, RefreshTokenService refreshTokens,
                       EmailCodeService emailCodes, ApplicationEventPublisher events) {
        this.users = users;
        this.userRoles = userRoles;
        this.userAccess = userAccess;
        this.passwordEncoder = passwordEncoder;
        this.rateLimits = rateLimits;
        this.accessTokens = accessTokens;
        this.refreshTokens = refreshTokens;
        this.emailCodes = emailCodes;
        this.events = events;
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    /**
     * Registrazione (progettazione, sezione 4.4). Email gia' verificata o account sospeso: 409. Email non
     * verificata: dopo i limiti di invio i nuovi dati sovrascrivono quelli in sospeso (nessuno ha ancora
     * dimostrato di possederla). Utente nuovo: riga in users e ruolo FAN, automatico e non rimovibile.
     * Niente noRollbackFor: se un limite di invio respinge la richiesta, i dati non devono cambiare.
     */
    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        // Lock sulla riga: due registrazioni insieme sulla stessa email = un solo invio.
        Optional<User> existing = users.findWithLockByEmail(request.email());
        String passwordHash = passwordEncoder.encode(request.password());
        User user;
        String code;
        if (existing.isPresent()) {
            user = existing.get();
            if (user.isEmailVerified() || user.getStatus() != UserStatus.ACTIVE) {
                throw new AppException(ErrorCode.EMAIL_ALREADY_REGISTERED, "Email già registrata");
            }
            // Prima il codice, che applica i limiti e puo' lanciare 429: i dati si sovrascrivono solo dopo.
            code = emailCodes.issue(user.getId(), EmailCodePurpose.EMAIL_VERIFICATION);
            user.setPasswordHash(passwordHash);
            user.setDisplayName(request.displayName());
        } else {
            // saveAndFlush: con due registrazioni parallele sulla stessa email nuova scatta uq_users_email,
            // che GlobalExceptionHandler traduce in 409 EMAIL_ALREADY_REGISTERED.
            user = users.saveAndFlush(new User(request.email(), passwordHash, request.displayName()));
            userRoles.save(new UserRole(user.getId(), Role.FAN));
            code = emailCodes.issue(user.getId(), EmailCodePurpose.EMAIL_VERIFICATION);
        }
        events.publishEvent(new VerificationCodeEmailEvent(user.getEmail(), user.getDisplayName(), code));
        return new RegisterResponse(user.getEmail());
    }

    /**
     * Verifica dell'email e apertura della sessione (progettazione, sezione 4.5), con i controlli nell'ordine
     * di NoseY: l'ordine decide quale errore vede il client. noRollbackFor: il tentativo consumato sul codice
     * deve restare salvato anche quando la verifica fallisce, altrimenti il limite dei 5 tentativi si aggirerebbe.
     */
    @Transactional(noRollbackFor = AppException.class)
    public AuthSession verify(VerifyRequest request) {
        // 1. utente inesistente: stessa risposta di un codice sbagliato, non rivela quali email esistono.
        User user = users.findWithLockByEmail(request.email())
                .orElseThrow(() -> new AppException(ErrorCode.CODE_INVALID, "Codice non valido"));
        // 2. e 3. gia' verificato, sospeso.
        if (user.isEmailVerified()) {
            throw new AppException(ErrorCode.ALREADY_VERIFIED, "Account già verificato");
        }
        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw suspended(user.getSuspensionReason(), user.getSuspendedUntil());
        }
        // 4.-6. codice assente o scaduto, tentativo consumato, confronto a tempo costante.
        emailCodes.verify(user.getId(), EmailCodePurpose.EMAIL_VERIFICATION, request.code());
        // 7. password della registrazione: una diversa non completa la verifica, il codice resta usabile.
        if (!passwordMatches(request.password(), user.getPasswordHash())) {
            throw new AppException(ErrorCode.WRONG_PASSWORD,
                    "Password diversa da quella della registrazione: se non la ricordi, registrati di nuovo");
        }
        // 8. successo.
        user.setEmailVerified(true);
        emailCodes.invalidate(user.getId(), EmailCodePurpose.EMAIL_VERIFICATION);
        return openSession(user.getId(), refreshTokens.create(user.getId()));
    }

    /**
     * Nuovo codice di verifica, solo per un account esistente, non verificato e ACTIVE; negli altri casi
     * nessun effetto e il client riceve comunque 204, cosi' non si scopre quali email esistono.
     */
    @Transactional
    public void resendCode(EmailRequest request) {
        // Lock sulla riga: due richieste insieme = un solo invio.
        users.findWithLockByEmail(request.email())
                .filter(user -> !user.isEmailVerified() && user.getStatus() == UserStatus.ACTIVE)
                .ifPresent(user -> {
                    String code = emailCodes.issue(user.getId(), EmailCodePurpose.EMAIL_VERIFICATION);
                    events.publishEvent(new VerificationCodeEmailEvent(user.getEmail(), user.getDisplayName(), code));
                });
    }

    /**
     * Password dimenticata (progettazione, sezione 4.10): invia il codice di reset solo a un account esistente,
     * verificato e ACTIVE; negli altri casi nessun effetto e il client riceve comunque 204, cosi' non si scopre
     * quali email esistono. Stessi limiti di invio dei codici di verifica (sezione 4.6).
     */
    @Transactional
    public void forgotPassword(EmailRequest request) {
        // Lock sulla riga: due richieste insieme = un solo invio.
        users.findWithLockByEmail(request.email())
                .filter(user -> user.isEmailVerified() && user.getStatus() == UserStatus.ACTIVE)
                .ifPresent(user -> {
                    String code = emailCodes.issue(user.getId(), EmailCodePurpose.PASSWORD_RESET);
                    events.publishEvent(new PasswordResetCodeEmailEvent(user.getEmail(), user.getDisplayName(), code));
                });
    }

    /**
     * Reset della password (progettazione, sezioni 4.10 e 4.11), con i controlli della verifica ma errori
     * piu' avari (decisione 51): codice sbagliato, scaduto o assente = sempre CODE_INVALID, e ACCOUNT_SUSPENDED
     * solo con il codice valido. Il tentativo consumato resta salvato (noRollbackFor), il confronto e' a tempo
     * costante. A reset riuscito
     * il codice si annulla, tutte le sessioni si revocano e parte l'email di avviso. Non apre una sessione.
     */
    @Transactional(noRollbackFor = AppException.class)
    public void resetPassword(ResetPasswordRequest request) {
        // Utente inesistente o non verificato: stessa risposta di un codice sbagliato, non rivela quali email
        // esistono (a un non verificato non e' mai stato inviato un codice di reset).
        User user = users.findWithLockByEmail(request.email())
                .filter(User::isEmailVerified)
                .orElseThrow(AuthService::invalidResetCode);
        // Codice sbagliato, scaduto o assente: sempre CODE_INVALID, anche per un account sospeso (decisione 51).
        // Il tentativo consumato resta salvato comunque (noRollbackFor).
        try {
            emailCodes.verify(user.getId(), EmailCodePurpose.PASSWORD_RESET, request.code());
        } catch (AppException e) {
            throw invalidResetCode();
        }
        // Solo con un codice valido (cioe' dopo aver dimostrato di possedere la casella) si dice che e' sospeso.
        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw suspended(user.getSuspensionReason(), user.getSuspendedUntil());
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        emailCodes.invalidate(user.getId(), EmailCodePurpose.PASSWORD_RESET);
        // Chi ha rubato la vecchia password non deve restare dentro con una sessione gia' aperta.
        refreshTokens.revokeAll(user.getId());
        events.publishEvent(new PasswordChangedEmailEvent(user.getEmail(), user.getDisplayName()));
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

    private static AppException invalidResetCode() {
        return new AppException(ErrorCode.CODE_INVALID, "Codice non valido");
    }

    private boolean passwordMatches(String password, String hash) {
        // Oltre 72 byte si risponde come per una password errata, senza chiamare BCrypt (review focus 2).
        return !PasswordMax72BytesValidator.exceedsLimit(password) && passwordEncoder.matches(password, hash);
    }

    private AppException suspended(UserAccess access) {
        return suspended(access.suspensionReason(), access.suspendedUntil());
    }

    private AppException suspended(String reason, Instant until) {
        // Il valore null e' ammesso: suspendedUntil e' nullo per una sospensione a tempo indeterminato.
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("suspensionReason", reason);
        details.put("suspendedUntil", until);
        return new AppException(ErrorCode.ACCOUNT_SUSPENDED, "Account sospeso").withDetails(details);
    }
}

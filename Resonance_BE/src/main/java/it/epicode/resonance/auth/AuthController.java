package it.epicode.resonance.auth;

import it.epicode.resonance.auth.dto.EmailRequest;
import it.epicode.resonance.auth.dto.LoginRequest;
import it.epicode.resonance.auth.dto.LoginResponse;
import it.epicode.resonance.auth.dto.RegisterRequest;
import it.epicode.resonance.auth.dto.RegisterResponse;
import it.epicode.resonance.auth.dto.VerifyRequest;
import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.common.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.time.Clock;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;

/**
 * Endpoint di autenticazione (progettazione, sezione 6.4). Il refresh token viaggia solo nel cookie
 * HttpOnly, mai nel body; l'access token solo nel body.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String CSRF_HEADER = "X-Requested-With";

    private final AuthService authService;
    private final RefreshCookieFactory cookies;
    private final Clock clock;
    private final String[] allowedOrigins;

    public AuthController(AuthService authService, RefreshCookieFactory cookies, Clock clock,
                          @Value("${app.cors.allowed-origins}") String[] allowedOrigins) {
        this.authService = authService;
        this.cookies = cookies;
        this.clock = clock;
        this.allowedOrigins = allowedOrigins;
    }

    /**
     * Registrazione (progettazione, sezione 4.4): 201 con la sola email; il codice parte per email dopo il commit.
     */
    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    /**
     * Verifica dell'email (progettazione, sezione 4.5): 200 con access token e profilo e il refresh token nel
     * cookie, come il login.
     */
    @PostMapping("/verify")
    public ResponseEntity<LoginResponse> verify(@Valid @RequestBody VerifyRequest request) {
        return withCookie(authService.verify(request));
    }

    /**
     * Reinvio del codice di verifica (progettazione, sezione 4.6): sempre 204, anche per un'email sconosciuta.
     */
    @PostMapping("/resend-code")
    public ResponseEntity<Void> resendCode(@Valid @RequestBody EmailRequest request) {
        authService.resendCode(request);
        return ResponseEntity.noContent().build();
    }

    /**
     * Login con email e password: 200 con access token e profilo, e il refresh token nel cookie.
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return withCookie(authService.login(request));
    }

    /**
     * Rotazione del refresh token (progettazione, sezione 4.8): 200 con access token nuovo e cookie nuovo;
     * 409 se e' il secondo di due refresh concorrenti; 401 o 403 con il cookie cancellato se il token non vale.
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(HttpServletRequest request,
                                     @RequestHeader(value = CSRF_HEADER, required = false) String requestedWith,
                                     @CookieValue(name = RefreshCookieFactory.COOKIE_NAME, required = false) String cookie) {
        checkCsrf(request, requestedWith);
        // Le revoche totali (riuso, sospensione) restano salvate: il service restituisce un esito, non lancia.
        return switch (authService.refresh(cookie)) {
            case RefreshOutcome.Rotated rotated ->
                    withCookie(authService.openSession(rotated.userId(), rotated.token()));
            // Il browser ha gia' il cookie nuovo: niente Set-Cookie, o lo si sovrascriverebbe con uno vecchio.
            case RefreshOutcome.Conflict conflict -> ResponseEntity.status(ErrorCode.REFRESH_CONFLICT.httpStatus())
                    .body(error(ErrorCode.REFRESH_CONFLICT, "Refresh già eseguito: riprova con il cookie aggiornato", Map.of()));
            case RefreshOutcome.Rejected rejected -> rejected(rejected);
        };
    }

    /**
     * Logout del dispositivo (progettazione, sezione 4.9): sempre 204 e cookie cancellato. Non richiede il
     * Bearer, quindi funziona anche con l'access token scaduto.
     */
    @DeleteMapping("/refresh")
    public ResponseEntity<Void> logout(HttpServletRequest request,
                                       @RequestHeader(value = CSRF_HEADER, required = false) String requestedWith,
                                       @CookieValue(name = RefreshCookieFactory.COOKIE_NAME, required = false) String cookie) {
        checkCsrf(request, requestedWith);
        authService.logout(cookie);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookies.clear().toString())
                .build();
    }

    private ResponseEntity<LoginResponse> withCookie(AuthSession session) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookies.create(session.refreshToken()).toString())
                .body(session.response());
    }

    private ResponseEntity<ErrorResponse> rejected(RefreshOutcome.Rejected rejected) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(rejected.code().httpStatus());
        if (rejected.clearCookie()) {
            builder.header(HttpHeaders.SET_COOKIE, cookies.clear().toString());
        }
        return builder.body(error(rejected.code(), messageFor(rejected.code()), rejected.details()));
    }

    private ErrorResponse error(ErrorCode code, String message, Map<String, Object> details) {
        return ErrorResponse.of(code, message, Map.of(), details, clock.instant());
    }

    private static String messageFor(ErrorCode code) {
        return switch (code) {
            case REFRESH_TOKEN_EXPIRED -> "Sessione scaduta: effettua di nuovo il login";
            case REFRESH_TOKEN_REUSED -> "Sessione non più valida: effettua di nuovo il login";
            case ACCOUNT_SUSPENDED -> "Account sospeso";
            default -> "Sessione non valida: effettua di nuovo il login";
        };
    }

    /**
     * Difesa di refresh e logout, che si basano su un cookie (progettazione, sezioni 4.8 e 8.5): header
     * X-Requested-With obbligatorio e, se c'e' l'header Origin, deve essere l'origine del servizio o una
     * di quelle configurate.
     */
    private void checkCsrf(HttpServletRequest request, String requestedWith) {
        if (requestedWith == null || requestedWith.isBlank()) {
            throw new AppException(ErrorCode.CSRF_HEADER_MISSING, "Header X-Requested-With mancante");
        }
        String origin = request.getHeader(HttpHeaders.ORIGIN);
        if (origin != null && !isAllowedOrigin(origin, request)) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Origine non ammessa");
        }
    }

    /**
     * Un'origine e' ammessa se e' fra quelle configurate o se host e porta coincidono con quelli del servizio.
     * Si confronta l'host dell'header Host e non lo schema: dietro il proxy di Render la richiesta arriva in
     * HTTP anche se il browser usa HTTPS, quindi lo schema visto dal servizio non e' affidabile.
     */
    private boolean isAllowedOrigin(String origin, HttpServletRequest request) {
        String normalized = origin.strip().replaceAll("/+$", "");
        if (Arrays.stream(allowedOrigins).map(String::strip).anyMatch(normalized::equalsIgnoreCase)) {
            return true;
        }
        try {
            String originAuthority = URI.create(normalized).getAuthority();
            return originAuthority != null && originAuthority.equalsIgnoreCase(serviceAuthority(request));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private String serviceAuthority(HttpServletRequest request) {
        String host = request.getHeader(HttpHeaders.HOST);
        if (host != null && !host.isBlank()) {
            return host.strip().toLowerCase(Locale.ROOT);
        }
        int port = request.getServerPort();
        boolean defaultPort = port == 80 || port == 443;
        return request.getServerName().toLowerCase(Locale.ROOT) + (defaultPort ? "" : ":" + port);
    }
}

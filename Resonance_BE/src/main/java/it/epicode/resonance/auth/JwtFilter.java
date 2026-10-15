package it.epicode.resonance.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Autentica la richiesta dal Bearer (progettazione, sezione 8.2). Token assente, non valido o scaduto,
 * e utente inesistente, non verificato o sospeso: NON risponde 401, prosegue senza autenticare. Il 401 lo
 * da' l'AuthenticationEntryPoint, e solo sugli endpoint protetti, cosi' un token vecchio rimasto nel
 * frontend non blocca le pagine pubbliche. Ruoli e stato arrivano dal database a ogni richiesta, mai
 * dal token.
 * <p>
 * Non e' un @Component: Spring Boot lo registrerebbe anche come filtro servlet e girerebbe due volte.
 */
public class JwtFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final AccessTokenService accessTokens;
    private final UserAccessService userAccess;

    public JwtFilter(AccessTokenService accessTokens, UserAccessService userAccess) {
        this.accessTokens = accessTokens;
        this.userAccess = userAccess;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            accessTokens.parse(header.substring(BEARER_PREFIX.length()).strip())
                    .ifPresent(claims -> authenticate(claims));
        }
        chain.doFilter(request, response);
    }

    /**
     * Imposta l'utente nel contesto di sicurezza solo se e' attivo (esiste, email verificata, non sospeso).
     */
    private void authenticate(AccessTokenClaims claims) {
        UserAccess access = userAccess.resolve(claims.userId());
        if (!access.isActive()) {
            return;
        }
        List<GrantedAuthority> authorities = access.roles().stream()
                .<GrantedAuthority>map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                .toList();
        AuthenticatedUser user = new AuthenticatedUser(access.userId(), access.roles(), claims.expiresAt());
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(user, null, authorities));
    }
}

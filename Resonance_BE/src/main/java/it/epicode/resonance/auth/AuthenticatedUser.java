package it.epicode.resonance.auth;

import it.epicode.resonance.user.Role;

import java.security.Principal;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/**
 * Chi fa la richiesta: principal di ogni richiesta autenticata. I ruoli sono quelli letti dal database
 * in quel momento, non dal token (progettazione, sezione 5.2); la scadenza dell'access token serve ai
 * controlli sul WebSocket.
 */
public record AuthenticatedUser(UUID id, Set<Role> roles, Instant accessTokenExpiresAt) implements Principal {

    public AuthenticatedUser {
        roles = Set.copyOf(roles);
    }

    @Override
    public String getName() {
        return id.toString();
    }
}

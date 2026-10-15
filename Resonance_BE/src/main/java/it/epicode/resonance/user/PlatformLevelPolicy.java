package it.epicode.resonance.user;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.UUID;

/**
 * Regola dei livelli di piattaforma (progettazione, sezione 5.6): chi agisce puo' farlo solo su un
 * bersaglio di livello inferiore e mai su se stesso. Vale per sospensioni, nomine e moderazione.
 */
@Component
public class PlatformLevelPolicy {

    /**
     * Livello di piattaforma dai ruoli: 2 = SUPERADMIN, 1 = ADMIN, 0 = solo ruoli di community.
     */
    public int levelOf(Set<Role> roles) {
        if (roles.contains(Role.SUPERADMIN)) {
            return 2;
        }
        return roles.contains(Role.ADMIN) ? 1 : 0;
    }

    /**
     * Verifica che chi agisce possa agire sul bersaglio; altrimenti 403 INSUFFICIENT_PLATFORM_LEVEL. Il
     * confronto "livello inferiore" esclude da solo anche un SUPERADMIN su un altro SUPERADMIN.
     */
    public void requireCanActOn(UUID actorId, Set<Role> actorRoles, UUID targetId, Set<Role> targetRoles) {
        if (actorId.equals(targetId)) {
            throw new AppException(ErrorCode.INSUFFICIENT_PLATFORM_LEVEL, "Non puoi agire su te stesso");
        }
        if (levelOf(targetRoles) >= levelOf(actorRoles)) {
            throw new AppException(ErrorCode.INSUFFICIENT_PLATFORM_LEVEL,
                    "Livello di piattaforma insufficiente per agire su questo utente");
        }
    }
}

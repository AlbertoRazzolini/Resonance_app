package it.epicode.resonance.user;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Regola dei livelli di piattaforma (progettazione, sezione 5.6): SUPERADMIN 2, ADMIN 1, solo community 0;
 * si agisce solo su un bersaglio di livello inferiore e mai su se stessi.
 */
class PlatformLevelPolicyTest {

    private final PlatformLevelPolicy policy = new PlatformLevelPolicy();

    private final UUID actorId = UUID.randomUUID();
    private final UUID targetId = UUID.randomUUID();

    @Test
    void levelOf_communityRolesOnly_isZero() {
        assertThat(policy.levelOf(Set.of(Role.FAN, Role.MUSICIAN, Role.HOST))).isZero();
        assertThat(policy.levelOf(Set.of())).isZero();
    }

    @Test
    void levelOf_admin_isOne_andSuperadmin_isTwo() {
        assertThat(policy.levelOf(Set.of(Role.FAN, Role.ADMIN))).isEqualTo(1);
        assertThat(policy.levelOf(Set.of(Role.FAN, Role.SUPERADMIN))).isEqualTo(2);
        // Un SUPERADMIN con anche la riga ADMIN resta al livello piu' alto.
        assertThat(policy.levelOf(Set.of(Role.ADMIN, Role.SUPERADMIN))).isEqualTo(2);
    }

    @Test
    void admin_onFan_isAllowed() {
        assertThatCode(() -> policy.requireCanActOn(actorId, Set.of(Role.FAN, Role.ADMIN), targetId, Set.of(Role.FAN)))
                .doesNotThrowAnyException();
    }

    @Test
    void admin_onAdmin_isRejected() {
        assertInsufficient(Set.of(Role.FAN, Role.ADMIN), actorId, Set.of(Role.FAN, Role.ADMIN), targetId);
    }

    @Test
    void superadmin_onAdmin_isAllowed() {
        assertThatCode(() -> policy.requireCanActOn(actorId, Set.of(Role.SUPERADMIN), targetId,
                Set.of(Role.FAN, Role.ADMIN))).doesNotThrowAnyException();
    }

    @Test
    void anyone_onThemselves_isRejected() {
        assertInsufficient(Set.of(Role.ADMIN), actorId, Set.of(Role.ADMIN), actorId);
        assertInsufficient(Set.of(Role.SUPERADMIN), actorId, Set.of(Role.SUPERADMIN), actorId);
        // Anche un utente di community, se mai arrivasse qui, non agisce su se stesso.
        assertInsufficient(Set.of(Role.FAN), actorId, Set.of(Role.FAN), actorId);
    }

    @Test
    void nobody_canActOnSuperadmin_notEvenAnotherSuperadmin() {
        assertInsufficient(Set.of(Role.ADMIN), actorId, Set.of(Role.SUPERADMIN), targetId);
        assertInsufficient(Set.of(Role.SUPERADMIN), actorId, Set.of(Role.SUPERADMIN), targetId);
    }

    private void assertInsufficient(Set<Role> actorRoles, UUID actor, Set<Role> targetRoles, UUID target) {
        assertThatThrownBy(() -> policy.requireCanActOn(actor, actorRoles, target, targetRoles))
                .isInstanceOfSatisfying(AppException.class, e ->
                        assertThat(e.getCode()).isEqualTo(ErrorCode.INSUFFICIENT_PLATFORM_LEVEL));
    }
}

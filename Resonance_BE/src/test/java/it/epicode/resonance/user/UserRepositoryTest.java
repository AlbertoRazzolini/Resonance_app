package it.epicode.resonance.user;

import it.epicode.resonance.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class UserRepositoryTest extends IntegrationTest {

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Test
    void saveUserWithRoles() {
        User user = new User();
        user.setEmail("mario@example.com");
        user.setPasswordHash("hash-di-prova");
        user.setDisplayName("Mario");
        users.save(user);
        roles.save(new UserRole(user.getId(), Role.FAN));
        roles.save(new UserRole(user.getId(), Role.MUSICIAN));

        User found = users.findByEmail("mario@example.com").orElseThrow();

        assertThat(found.getId()).isEqualTo(user.getId());
        assertThat(found.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(found.isEmailVerified()).isFalse();
        assertThat(found.getCreatedAt()).isNotNull();
        assertThat(roles.findRolesByUserId(user.getId())).containsExactlyInAnyOrder(Role.FAN, Role.MUSICIAN);
        assertThat(roles.existsByIdRole(Role.MUSICIAN)).isTrue();
        assertThat(roles.existsByIdRole(Role.SUPERADMIN)).isFalse();
    }
}

package it.epicode.resonance.admin;

import it.epicode.resonance.admin.dto.SuspendUserRequest;
import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.auth.RefreshTokenService;
import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.user.PlatformLevelPolicy;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Il controllo "ultimo SUPERADMIN" della sospensione (progettazione, sezione 5.5). Con la regola dei livelli
 * attiva non e' raggiungibile via HTTP, quindi si prova qui con la regola dei livelli sostituita da un finto
 * che lascia passare tutto.
 */
@ExtendWith(MockitoExtension.class)
class AdminUserServiceTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-15T10:00:00Z"), ZoneOffset.UTC);

    @Mock
    private UserRepository users;

    @Mock
    private UserRoleRepository userRoles;

    @Mock
    private PlatformLevelPolicy policy;

    @Mock
    private RefreshTokenService refreshTokens;

    @Mock
    private ApplicationEventPublisher events;

    private final UUID targetId = UUID.randomUUID();
    private final AuthenticatedUser actor =
            new AuthenticatedUser(UUID.randomUUID(), Set.of(Role.SUPERADMIN), Instant.now());

    private AdminUserService service() {
        return new AdminUserService(users, userRoles, policy, refreshTokens, events, CLOCK);
    }

    @Test
    void suspend_lastActiveSuperadmin_isRejected_andNothingChanges() {
        User target = userWithId();
        when(users.findWithLockById(targetId)).thenReturn(Optional.of(target));
        when(userRoles.findRolesByUserId(targetId)).thenReturn(Set.of(Role.SUPERADMIN));
        when(users.countByRoleAndStatusExcluding(Role.SUPERADMIN, UserStatus.ACTIVE, targetId)).thenReturn(0L);

        assertThatThrownBy(() -> service().suspend(targetId, new SuspendUserRequest("Spam", null, null), actor))
                .isInstanceOfSatisfying(AppException.class, e ->
                        assertThat(e.getCode()).isEqualTo(ErrorCode.LAST_SUPERADMIN));

        assertThat(target.getStatus()).isEqualTo(UserStatus.ACTIVE);
        verify(users, never()).save(any());
        verify(refreshTokens, never()).revokeAll(any());
        verify(events, never()).publishEvent(any(Object.class));
    }

    @Test
    void suspend_superadminWithAnotherActiveSuperadmin_isNotBlockedByTheLastSuperadminCheck() {
        User target = userWithId();
        when(users.findWithLockById(targetId)).thenReturn(Optional.of(target));
        when(userRoles.findRolesByUserId(targetId)).thenReturn(Set.of(Role.SUPERADMIN));
        when(users.countByRoleAndStatusExcluding(Role.SUPERADMIN, UserStatus.ACTIVE, targetId)).thenReturn(1L);

        service().suspend(targetId, new SuspendUserRequest("Spam", null, null), actor);

        assertThat(target.getStatus()).isEqualTo(UserStatus.SUSPENDED);
    }

    private User userWithId() {
        User user = new User("target@example.com", "hash-di-prova", "Target");
        ReflectionTestUtils.setField(user, "id", targetId);
        return user;
    }
}

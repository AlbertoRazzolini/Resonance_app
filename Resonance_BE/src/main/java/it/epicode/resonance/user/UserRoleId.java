package it.epicode.resonance.user;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AccessLevel;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.io.Serializable;
import java.util.UUID;

/**
 * Chiave composta di user_roles: (user_id, role).
 */
@Embeddable
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
@ToString
@Getter
@EqualsAndHashCode
public class UserRoleId implements Serializable {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "role", nullable = false)
    private Role role;

    public UserRoleId(UUID userId, Role role) {
        this.userId = userId;
        this.role = role;
    }
}

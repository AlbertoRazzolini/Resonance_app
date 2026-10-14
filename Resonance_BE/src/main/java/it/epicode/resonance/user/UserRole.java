package it.epicode.resonance.user;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.Instant;
import java.util.UUID;

/**
 * Una riga per ogni ruolo attivo di un utente (progettazione, sezione 3.2).
 */
@Entity
@Table(name = "user_roles")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
public class UserRole {

    @EmbeddedId
    private UserRoleId id;

    // Valorizzato dal database (DEFAULT now()) e riletto dopo l'insert.
    @Generated(event = EventType.INSERT)
    @Column(name = "granted_at", nullable = false, insertable = false, updatable = false)
    private Instant grantedAt;

    public UserRole(UUID userId, Role role) {
        this.id = new UserRoleId(userId, role);
    }
}

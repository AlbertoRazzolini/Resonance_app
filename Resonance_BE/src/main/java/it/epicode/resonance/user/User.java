package it.epicode.resonance.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Utente (progettazione, sezione 3.2). I ruoli stanno in {@link UserRole}, non qui.
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Sempre minuscola e senza spazi: la normalizza l'applicazione, il database non la controlla.
    @Column(nullable = false, length = 255)
    private String email;

    // Hash BCrypt, mai la password in chiaro.
    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(name = "display_name", nullable = false, length = 50)
    private String displayName;

    // Solo URL http/https, validato dall'applicazione: nell'MVP non ci sono upload (decisione 2).
    @Column(name = "avatar_url", length = 2048)
    private String avatarUrl;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false)
    private UserStatus status = UserStatus.ACTIVE;

    @Column(length = 500)
    private String bio;

    @Column(length = 100)
    private String city;

    // Gradi. Latitudine e longitudine sono entrambe nulle finche' l'utente non condivide la posizione
    // (progettazione, sezione 1.2); il vincolo ck_users_coordinates controlla anche i range.
    private Double latitude;

    private Double longitude;

    // Valorizzato dal database (DEFAULT now()) e riletto dopo l'insert.
    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    // Campi di sospensione: valorizzati solo se status = SUSPENDED (ck_users_suspension, sezione 5.5).
    // suspendedUntil nullo = sospensione a tempo indeterminato.
    @Column(name = "suspended_at")
    private Instant suspendedAt;

    @Column(name = "suspended_by")
    private UUID suspendedBy;

    @Column(name = "suspension_reason", length = 500)
    private String suspensionReason;

    @Column(name = "suspended_until")
    private Instant suspendedUntil;
}

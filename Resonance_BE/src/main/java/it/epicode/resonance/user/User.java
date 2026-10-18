package it.epicode.resonance.user;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
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
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
@ToString
@Getter
@Setter
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Setter(AccessLevel.NONE)
    private UUID id;

    // Sempre minuscola e senza spazi: la normalizza l'applicazione, il database non la controlla.
    @Column(nullable = false, unique = true)
    private String email;

    // Hash BCrypt, mai la password in chiaro. Fuori da JSON e da toString: non deve mai finire nei log
    // (progettazione, sezione 8.9).
    @Column(name = "password_hash", nullable = false)
    @JsonIgnore
    @ToString.Exclude
    private String passwordHash;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    // Solo URL http/https, validato dall'applicazione: nell'MVP non ci sono upload (decisione 2).
    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false)
    private UserStatus status = UserStatus.ACTIVE;

    private String bio;

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

    @Column(name = "suspension_reason")
    private String suspensionReason;

    @Column(name = "suspended_until")
    private Instant suspendedUntil;

    /**
     * Crea un utente con i dati obbligatori. Gli altri campi partono dai valori iniziali:
     * stato ACTIVE, email non verificata, nessun dato facoltativo. I ruoli si assegnano a parte
     * con {@link UserRole}.
     */
    public User(String email, String passwordHash, String displayName) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
    }
    /**
     * Riporta l'utente ad ACTIVE e azzera insieme i quattro campi della sospensione, come chiede il vincolo
     * {@code ck_users_suspension} (decisione 75, O4).
     */
    public void clearSuspension() {
        this.status = UserStatus.ACTIVE;
        this.suspendedAt = null;
        this.suspendedBy = null;
        this.suspensionReason = null;
        this.suspendedUntil = null;
    }
}

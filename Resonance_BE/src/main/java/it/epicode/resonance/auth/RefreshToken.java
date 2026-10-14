package it.epicode.resonance.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * Refresh token di un utente (progettazione, sezioni 3.2 e 4.2): nel database c'e' solo l'hash del valore.
 */
@Entity
@Table(name = "refresh_tokens")
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
@ToString
@Getter
@Setter
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Setter(AccessLevel.NONE)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    // SHA-256 esadecimale (64 caratteri), colonna char(64): senza il tipo CHAR la validazione dello schema
    // si aspetterebbe un varchar. Fuori da toString per non finire nei log.
    @Column(name = "token_hash", nullable = false)
    @JdbcTypeCode(SqlTypes.CHAR)
    @ToString.Exclude
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(nullable = false)
    private boolean revoked = false;

    // Valorizzato dal database (DEFAULT now()) e riletto dopo l'insert.
    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    // Istante della revoca: la finestra di tolleranza di 10 secondi parte da qui (sezione 4.8).
    @Column(name = "revoked_at")
    private Instant revokedAt;

    // Token che ha sostituito questo nella rotazione; nullo se revocato da logout o da revoca totale.
    @Column(name = "replaced_by")
    private UUID replacedBy;

    /**
     * Crea un token valido (non revocato) per l'utente, con l'hash del valore e la scadenza.
     */
    public RefreshToken(UUID userId, String tokenHash, Instant expiresAt) {
        this.userId = userId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }
}

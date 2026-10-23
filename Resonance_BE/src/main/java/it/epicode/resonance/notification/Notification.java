package it.epicode.resonance.notification;

import it.epicode.resonance.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Notifica salvata per un utente (decisione 97, progettazione, sezioni 3.2 e 7.6): resta finche' non scade
 * e ha uno stato di lettura.
 */
@Entity
@Table(name = "notifications")
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
@ToString
@Getter
@Setter
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Setter(AccessLevel.NONE)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_id", nullable = false)
    @ToString.Exclude
    @Setter(AccessLevel.NONE)
    private User recipient;

    // Chi ha compiuto l'azione (il like, la richiesta, l'accettazione).
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_id", nullable = false)
    @ToString.Exclude
    @Setter(AccessLevel.NONE)
    private User actor;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false)
    @Setter(AccessLevel.NONE)
    private NotificationType type;

    // Post, annuncio o amicizia secondo il tipo: nessuna chiave esterna.
    @Column(name = "target_id", nullable = false)
    @Setter(AccessLevel.NONE)
    private UUID targetId;

    // Dall'orologio dell'applicazione, come l'orario del payload live.
    @Column(name = "created_at", nullable = false)
    @Setter(AccessLevel.NONE)
    private Instant createdAt;

    // Vuoto finche' la notifica non e' stata letta.
    @Column(name = "read_at")
    private Instant readAt;

    /**
     * Crea una notifica non letta con i campi obbligatori.
     */
    public Notification(User recipient, User actor, NotificationType type, UUID targetId, Instant createdAt) {
        this.recipient = recipient;
        this.actor = actor;
        this.type = type;
        this.targetId = targetId;
        this.createdAt = createdAt;
    }
}

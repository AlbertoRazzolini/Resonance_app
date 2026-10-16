package it.epicode.resonance.friendship;

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
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Amicizia fra due utenti (progettazione, sezioni 3.2 e 6.14): una sola riga per coppia, riaperta invece di
 * duplicata quando una delle due parti chiede di nuovo.
 */
@Entity
@Table(name = "friendships")
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
@ToString
@Getter
@Setter
public class Friendship {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Setter(AccessLevel.NONE)
    private UUID id;

    // Chi ha inviato l'ultima richiesta: cambia quando la riga si riapre dall'altra parte.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_id", nullable = false)
    @ToString.Exclude
    private User requester;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "addressee_id", nullable = false)
    @ToString.Exclude
    private User addressee;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false)
    private FriendshipStatus status;

    // Chi ha rifiutato o rimosso: valorizzato se e solo se lo stato e' DECLINED o REMOVED (ck_friendships_closed_by).
    @Column(name = "closed_by")
    private UUID closedBy;

    // Rifiuto silenzioso (decisione 59): vero solo con DECLINED, finche' il richiedente vede ancora la richiesta.
    @Column(name = "request_masked", nullable = false)
    private boolean requestMasked = false;

    // Valorizzato dal database (DEFAULT now()) e riletto dopo l'insert.
    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    // Ultimo cambiamento di stato, dall'orologio dell'applicazione: ordina gli elenchi.
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /**
     * Crea una riga con i campi obbligatori; chiusura e rifiuto silenzioso partono vuoti.
     */
    public Friendship(User requester, User addressee, FriendshipStatus status, Instant updatedAt) {
        this.requester = requester;
        this.addressee = addressee;
        this.status = status;
        this.updatedAt = updatedAt;
    }

    /**
     * Stato visto da {@code userId} verso l'altra parte (progettazione, sezione 6.14): il rifiuto resta invisibile
     * a chi ha chiesto, mentre chi e' stato rimosso non puo' piu' chiedere.
     */
    public FriendshipView viewFor(UUID userId) {
        boolean closedByMe = userId.equals(closedBy);
        return switch (status) {
            case PENDING -> requester.getId().equals(userId) ? FriendshipView.OUTGOING : FriendshipView.INCOMING;
            case ACCEPTED -> FriendshipView.FRIENDS;
            case CANCELLED -> FriendshipView.NONE;
            // Chiusa da me: posso riaprire. Chiusa dall'altro con la maschera: per me la richiesta e' ancora inviata.
            case DECLINED -> !closedByMe && requestMasked ? FriendshipView.OUTGOING : FriendshipView.NONE;
            case REMOVED -> closedByMe ? FriendshipView.NONE : FriendshipView.UNAVAILABLE;
        };
    }
}

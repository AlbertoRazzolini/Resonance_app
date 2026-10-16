package it.epicode.resonance.collab;

import it.epicode.resonance.moderation.Moderation;
import it.epicode.resonance.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Annuncio con cui un MUSICIAN cerca un collaboratore (progettazione, sezione 3.2). Resta consultabile anche
 * dopo la chiusura; la cancellazione e' logica, tramite {@link Moderation}.
 */
@Entity
@Table(name = "collab_posts")
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
@ToString
@Getter
@Setter
public class CollabPost {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Setter(AccessLevel.NONE)
    private UUID id;

    // Lazy: l'autore serve solo alle risposte, che lo caricano insieme all'annuncio.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "musician_id", nullable = false)
    @ToString.Exclude
    @Setter(AccessLevel.NONE)
    private User musician;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String description;

    @Column(name = "role_needed", nullable = false)
    private String roleNeeded;

    // Minuscoli e senza duplicati: li normalizza la richiesta prima del salvataggio.
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "genre_tags", nullable = false)
    private List<String> genreTags = new ArrayList<>();

    private String location;

    // Falso dopo la chiusura da parte dell'autore: fuori dalla lista pubblica, ma ancora nel dettaglio.
    @Column(name = "is_open", nullable = false)
    private boolean open = true;

    // Valorizzato dal database (DEFAULT now()) e riletto dopo l'insert.
    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Embedded
    private Moderation moderation = new Moderation();

    /**
     * Crea un annuncio con i campi obbligatori. Generi e luogo restano vuoti finche' non si impostano; parte
     * aperto e visibile.
     */
    public CollabPost(User musician, String title, String description, String roleNeeded) {
        this.musician = musician;
        this.title = title;
        this.description = description;
        this.roleNeeded = roleNeeded;
    }

    /**
     * Stato di moderazione, mai null. Hibernate rilegge come null un embeddable con tutte le colonne nulle,
     * cioe' ogni contenuto visibile: qui lo si ricrea vuoto (decisione 56).
     */
    public Moderation getModeration() {
        if (moderation == null) {
            moderation = new Moderation();
        }
        return moderation;
    }
}

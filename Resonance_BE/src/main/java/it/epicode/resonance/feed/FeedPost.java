package it.epicode.resonance.feed;

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
import org.hibernate.generator.EventType;

import java.time.Instant;
import java.util.UUID;

/**
 * Post del feed (progettazione, sezione 3.2). Le coordinate sono facoltative ma vanno insieme; il contatore dei
 * like lo aggiorna solo il database (sezione 3.4); la cancellazione e' logica, tramite {@link Moderation}.
 */
@Entity
@Table(name = "feed_posts")
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
@ToString
@Getter
@Setter
public class FeedPost {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Setter(AccessLevel.NONE)
    private UUID id;

    // Lazy: l'autore serve solo alle risposte, che lo caricano insieme al post.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    @ToString.Exclude
    @Setter(AccessLevel.NONE)
    private User author;

    @Column(nullable = false)
    private String body;

    @Column(name = "image_url")
    private String imageUrl;

    // Gradi; entrambe valorizzate o entrambe nulle (vincolo ck_feed_posts_coordinates).
    private Double latitude;

    private Double longitude;

    // Solo lettura per l'applicazione: like e unlike lo cambiano con un UPDATE atomico (sezione 3.4).
    @Column(name = "likes_count", nullable = false, insertable = false, updatable = false)
    @Generated(event = EventType.INSERT)
    @Setter(AccessLevel.NONE)
    private int likesCount;

    // Valorizzato dal database (DEFAULT now()) e riletto dopo l'insert.
    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Embedded
    private Moderation moderation = new Moderation();

    /**
     * Crea un post con il solo testo, che e' l'unico campo obbligatorio; immagine e coordinate si impostano a parte.
     */
    public FeedPost(User author, String body) {
        this.author = author;
        this.body = body;
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

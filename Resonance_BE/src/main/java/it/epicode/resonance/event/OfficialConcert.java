package it.epicode.resonance.event;

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
 * Concerto ufficiale pubblicato da un HOST (progettazione, sezione 3.2). Le coordinate vengono dalla
 * geocodifica dell'indirizzo, mai dal client. La cancellazione e' logica, tramite {@link Moderation}.
 */
@Entity
@Table(name = "official_concerts")
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
@ToString
@Getter
@Setter
public class OfficialConcert {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Setter(AccessLevel.NONE)
    private UUID id;

    // Lazy: l'autore serve solo alle risposte, che lo caricano insieme al concerto.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "host_id", nullable = false)
    @ToString.Exclude
    @Setter(AccessLevel.NONE)
    private User host;

    @Column(nullable = false)
    private String title;

    private String description;

    @Column(name = "venue_name", nullable = false)
    private String venueName;

    @Column(nullable = false)
    private String address;

    // Gradi, ricavati dall'indirizzo con la geocodifica (progettazione, sezione 10.1).
    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    @Column(name = "event_date", nullable = false)
    private Instant eventDate;

    // Minuscoli e senza duplicati: li normalizza la richiesta prima del salvataggio.
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "genre_tags", nullable = false)
    private List<String> genreTags = new ArrayList<>();

    @Column(name = "cover_image_url")
    private String coverImageUrl;

    @Column(name = "external_ticket_url")
    private String externalTicketUrl;

    // Valorizzato dal database (DEFAULT now()) e riletto dopo l'insert.
    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Embedded
    private Moderation moderation = new Moderation();

    /**
     * Crea un concerto con i campi obbligatori. Generi, descrizione e link restano vuoti finche' non si
     * impostano; la moderazione parte da "visibile".
     */
    public OfficialConcert(User host, String title, String venueName, String address, double latitude,
                           double longitude, Instant eventDate) {
        this.host = host;
        this.title = title;
        this.venueName = venueName;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
        this.eventDate = eventDate;
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

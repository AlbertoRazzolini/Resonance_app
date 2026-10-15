package it.epicode.resonance.auth;

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
 * Codice email attivo di un utente per uno scopo, con i contatori dei limiti di invio (progettazione,
 * sezioni 3.2 e 4.6). Una sola riga per coppia (utente, scopo): un nuovo invio la aggiorna.
 */
@Entity
@Table(name = "email_codes")
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
@ToString
@Getter
@Setter
public class EmailCode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Setter(AccessLevel.NONE)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    @Setter(AccessLevel.NONE)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false)
    @Setter(AccessLevel.NONE)
    private EmailCodePurpose purpose;

    // Sei cifre in chiaro (progettazione, sezione 3.2): nullo dopo l'uso. Fuori da toString per non finire nei log.
    @ToString.Exclude
    private String code;

    // Ultimo invio: da qui contano i 60 secondi fra due invii e i 15 minuti di validita'.
    @Column(name = "sent_at")
    private Instant sentAt;

    // Tentativi di verifica gia' consumati, al massimo 5.
    @Column(nullable = false)
    private int attempts = 0;

    // Invii nella finestra corrente di 24 ore, al massimo 5.
    @Column(name = "sends_count", nullable = false)
    private int sendsCount = 0;

    @Column(name = "sends_window_start")
    private Instant sendsWindowStart;

    // Valorizzato dal database (DEFAULT now()) e riletto dopo l'insert.
    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    /**
     * Crea la riga vuota (senza codice attivo) per l'utente e lo scopo; il primo invio la valorizza.
     */
    public EmailCode(UUID userId, EmailCodePurpose purpose) {
        this.userId = userId;
        this.purpose = purpose;
    }
}

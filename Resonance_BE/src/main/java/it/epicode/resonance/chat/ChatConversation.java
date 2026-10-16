package it.epicode.resonance.chat;

import it.epicode.resonance.user.User;
import jakarta.persistence.Column;
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
 * Conversazione privata fra due utenti (progettazione, sezione 3.2): una sola per coppia, con gli id in ordine
 * canonico ({@code userA < userB}) cosi' non importa chi la apre.
 */
@Entity
@Table(name = "chat_conversations")
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
@ToString
@Getter
@Setter
public class ChatConversation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Setter(AccessLevel.NONE)
    private UUID id;

    // Il minore dei due id (ck_chat_conversations_order).
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_a_id", nullable = false)
    @ToString.Exclude
    @Setter(AccessLevel.NONE)
    private User userA;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_b_id", nullable = false)
    @ToString.Exclude
    @Setter(AccessLevel.NONE)
    private User userB;

    // Valorizzato dal database (DEFAULT now()) e riletto dopo l'insert.
    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private Instant createdAt;

    // Nullo finche' non c'e' un messaggio: ordina la lista delle conversazioni.
    @Column(name = "last_message_at")
    private Instant lastMessageAt;

    /**
     * Crea la conversazione; il chiamante passa gli utenti gia' in ordine canonico.
     */
    public ChatConversation(User userA, User userB) {
        this.userA = userA;
        this.userB = userB;
    }

    /**
     * Se l'utente e' uno dei due membri.
     */
    public boolean hasMember(UUID userId) {
        return userA.getId().equals(userId) || userB.getId().equals(userId);
    }

    /**
     * L'altro membro rispetto a {@code userId}.
     */
    public User otherThan(UUID userId) {
        return userA.getId().equals(userId) ? userB : userA;
    }
}

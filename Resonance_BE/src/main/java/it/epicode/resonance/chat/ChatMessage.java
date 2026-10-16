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

import java.time.Instant;
import java.util.UUID;

/**
 * Messaggio di una conversazione (progettazione, sezione 3.2). Il testo non cambia; si aggiorna solo la lettura.
 */
@Entity
@Table(name = "chat_messages")
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
@ToString
@Getter
@Setter
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Setter(AccessLevel.NONE)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    @ToString.Exclude
    @Setter(AccessLevel.NONE)
    private ChatConversation conversation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_id", nullable = false)
    @ToString.Exclude
    @Setter(AccessLevel.NONE)
    private User sender;

    @Column(nullable = false)
    @Setter(AccessLevel.NONE)
    private String body;

    // Nullo finche' l'altro membro non lo legge.
    @Column(name = "read_at")
    private Instant readAt;

    // Dall'orologio dell'applicazione (non dal DEFAULT), cosi' i test controllano l'ordine dei messaggi.
    @Column(name = "sent_at", nullable = false)
    @Setter(AccessLevel.NONE)
    private Instant sentAt;

    /**
     * Crea un messaggio non ancora letto.
     */
    public ChatMessage(ChatConversation conversation, User sender, String body, Instant sentAt) {
        this.conversation = conversation;
        this.sender = sender;
        this.body = body;
        this.sentAt = sentAt;
    }
}

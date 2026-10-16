package it.epicode.resonance.chat;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.Instant;
import java.util.UUID;

/**
 * Sblocco di una conversazione: una candidatura o un contatto che permette di scrivere anche senza amicizia
 * finche' l'origine e' aperta (progettazione, sezioni 3.2 e 6.9). Le righe si creano con
 * {@link ChatUnlockRepository#insertIfAbsent}, non con {@code save}: la stessa origine non si duplica.
 */
@Entity
@Table(name = "chat_unlocks")
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
@ToString
@Getter
public class ChatUnlock {

    @EmbeddedId
    private ChatUnlockId id;

    // Valorizzato dal database (DEFAULT now()) e riletto dopo l'insert.
    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    public ChatUnlock(UUID conversationId, ChatUnlockSource sourceType, UUID sourceId) {
        this.id = new ChatUnlockId(conversationId, sourceType, sourceId);
    }
}

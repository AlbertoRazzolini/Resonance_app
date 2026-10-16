package it.epicode.resonance.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AccessLevel;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.io.Serializable;
import java.util.UUID;

/**
 * Chiave composta di chat_unlocks: (conversazione, tipo di origine, id dell'origine).
 */
@Embeddable
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
@ToString
@Getter
@EqualsAndHashCode
public class ChatUnlockId implements Serializable {

    @Column(name = "conversation_id", nullable = false)
    private UUID conversationId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "source_type", nullable = false)
    private ChatUnlockSource sourceType;

    @Column(name = "source_id", nullable = false)
    private UUID sourceId;

    public ChatUnlockId(UUID conversationId, ChatUnlockSource sourceType, UUID sourceId) {
        this.conversationId = conversationId;
        this.sourceType = sourceType;
        this.sourceId = sourceId;
    }
}

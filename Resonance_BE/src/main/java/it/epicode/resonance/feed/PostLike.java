package it.epicode.resonance.feed;

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
 * Like di un utente a un post (progettazione, sezione 3.2): una riga per coppia, quindi mai due like dello stesso
 * utente. Righe di sola lettura per l'applicazione: si creano e si tolgono con le query di {@link PostLikeRepository}.
 */
@Entity
@Table(name = "post_likes")
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
@ToString
@Getter
public class PostLike {

    @EmbeddedId
    private PostLikeId id;

    // Valorizzato dal database (DEFAULT now()) e riletto dopo l'insert.
    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    /**
     * Registra il like di un utente a un post; la data la imposta il database.
     */
    public PostLike(UUID userId, UUID postId) {
        this.id = new PostLikeId(userId, postId);
    }
}

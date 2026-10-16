package it.epicode.resonance.feed;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AccessLevel;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.io.Serializable;
import java.util.UUID;

/**
 * Chiave composta di post_likes: (user_id, post_id).
 */
@Embeddable
@NoArgsConstructor(access = AccessLevel.PROTECTED) // solo per JPA (decisione 41)
@ToString
@Getter
@EqualsAndHashCode
public class PostLikeId implements Serializable {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "post_id", nullable = false)
    private UUID postId;

    public PostLikeId(UUID userId, UUID postId) {
        this.userId = userId;
        this.postId = postId;
    }
}

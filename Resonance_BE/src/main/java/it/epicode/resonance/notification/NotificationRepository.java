package it.epicode.resonance.notification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Accesso alle notifiche salvate (decisione 97). Le modifiche in blocco restituiscono le righe toccate.
 */
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /**
     * Salva la notifica di like se per la coppia autore-post non c'e' gia': 1 se ha inserito la riga, 0 se esisteva.
     * Con {@code ON CONFLICT DO NOTHING} due like simultanei non danno errore e solo uno inserisce
     * ({@code uq_notifications_like}). L'id lo sceglie il chiamante, cosi' la notifica live puo' portarlo.
     */
    @Modifying
    @Query(nativeQuery = true, value = """
            insert into notifications (id, recipient_id, actor_id, type, target_id, created_at)
            values (:id, :recipientId, :actorId, cast('NEW_LIKE' as notification_type), :targetId, :createdAt)
            on conflict do nothing""")
    int insertLikeIfAbsent(UUID id, UUID recipientId, UUID actorId, UUID targetId, Instant createdAt);

    /**
     * Segna lette le notifiche non ancora lette del destinatario per quel tipo e bersaglio.
     */
    @Modifying
    @Query("""
            update Notification n set n.readAt = :readAt
            where n.recipient.id = :recipientId and n.type = :type and n.targetId = :targetId and n.readAt is null""")
    int markRead(UUID recipientId, NotificationType type, UUID targetId, Instant readAt);

    /**
     * Una pagina di notifiche del destinatario; l'ordine lo da' il {@code Pageable}. Carica l'autore con la pagina.
     */
    @EntityGraph(attributePaths = "actor")
    Page<Notification> findByRecipientId(UUID recipientId, Pageable pageable);

    /**
     * La notifica solo se e' del destinatario: per le altre il risultato e' vuoto, come se non esistessero.
     */
    Optional<Notification> findByIdAndRecipientId(UUID id, UUID recipientId);

    /**
     * Quante notifiche non lette ha il destinatario.
     */
    long countByRecipientIdAndReadAtIsNull(UUID recipientId);

    /**
     * Segna lette tutte le non lette del destinatario.
     */
    @Modifying
    @Query("update Notification n set n.readAt = :readAt where n.recipient.id = :recipientId and n.readAt is null")
    int markAllRead(UUID recipientId, Instant readAt);

    /**
     * Cancella tutte le notifiche create prima dell'istante indicato, lette o no.
     */
    @Modifying
    @Query("delete from Notification n where n.createdAt < :before")
    int deleteCreatedBefore(Instant before);

    /**
     * Cancella le notifiche del destinatario per quel tipo e bersaglio.
     */
    @Modifying
    @Query("delete from Notification n where n.recipient.id = :recipientId and n.type = :type "
            + "and n.targetId = :targetId")
    int deleteByTarget(UUID recipientId, NotificationType type, UUID targetId);
}

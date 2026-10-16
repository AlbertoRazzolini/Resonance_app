package it.epicode.resonance.chat;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Accesso ai messaggi: storico a cursore su {@code (sent_at, id)}, ultimo messaggio e non letti per pagina.
 */
public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    /**
     * Prima pagina dello storico: dal piu' recente, nello stesso ordine di {@code ix_chat_messages_cursor}.
     */
    @Query("select m from ChatMessage m where m.conversation.id = :conversationId order by m.sentAt desc, m.id desc")
    List<ChatMessage> findLatest(UUID conversationId, Limit limit);

    /**
     * Pagine successive: i messaggi che vengono dopo il cursore nello stesso ordine. Il cursore si legge dal
     * database nella stessa query: nessun confronto con un {@code Instant} in memoria, che puo' avere una
     * precisione diversa da quella di {@code timestamptz}; a pari istante decide l'id.
     */
    @Query("""
            select m from ChatMessage m
            where m.conversation.id = :conversationId
              and (m.sentAt < (select b.sentAt from ChatMessage b where b.id = :beforeId)
                   or (m.sentAt = (select b.sentAt from ChatMessage b where b.id = :beforeId)
                       and m.id < :beforeId))
            order by m.sentAt desc, m.id desc""")
    List<ChatMessage> findBefore(UUID conversationId, UUID beforeId, Limit limit);

    /**
     * Se il messaggio appartiene alla conversazione (il cursore di un'altra conversazione e' un 404).
     */
    boolean existsByIdAndConversationId(UUID id, UUID conversationId);

    /**
     * L'ultimo messaggio di ognuna delle conversazioni indicate, con una sola query.
     */
    @Query(nativeQuery = true, value = """
            select distinct on (conversation_id) * from chat_messages
            where conversation_id in (:conversationIds)
            order by conversation_id, sent_at desc, id desc""")
    List<ChatMessage> findLastOfEach(Collection<UUID> conversationIds);

    /**
     * Messaggi dell'altro non ancora letti da {@code me}, per ognuna delle conversazioni indicate.
     */
    @Query("""
            select new it.epicode.resonance.chat.ChatMessageRepository$UnreadCount(m.conversation.id, count(m))
            from ChatMessage m
            where m.conversation.id in :conversationIds and m.sender.id <> :me and m.readAt is null
            group by m.conversation.id""")
    List<UnreadCount> countUnread(Collection<UUID> conversationIds, UUID me);

    /**
     * Segna come letti i messaggi dell'altro; i propri restano come sono (li legge l'altro).
     */
    @Modifying(flushAutomatically = true)
    @Query("""
            update ChatMessage m set m.readAt = :now
            where m.conversation.id = :conversationId and m.sender.id <> :me and m.readAt is null""")
    int markReadFor(UUID conversationId, UUID me, Instant now);

    /**
     * Non letti di una conversazione, riga del risultato di {@link #countUnread}.
     */
    record UnreadCount(UUID conversationId, long count) {
    }
}

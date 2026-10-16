package it.epicode.resonance.chat;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Accesso agli sblocchi e alla regola "origine ancora aperta" (progettazione, sezione 6.9).
 */
public interface ChatUnlockRepository extends JpaRepository<ChatUnlock, ChatUnlockId> {

    /**
     * Condizione "sblocco con origine aperta" sull'alias {@code u} di {@code chat_unlocks}: un {@code exists} per
     * ogni tipo di origine. Annuncio aperto e non nascosto; concerto non nascosto e non ancora iniziato; indie event
     * pubblicato, non nascosto e non ancora iniziato.
     */
    String SOURCE_IS_OPEN = """
            ((u.source_type = 'COLLAB_POST' and exists (
                select 1 from collab_posts p
                where p.id = u.source_id and p.is_open and p.hidden_at is null))
             or (u.source_type = 'OFFICIAL_CONCERT' and exists (
                select 1 from official_concerts c
                where c.id = u.source_id and c.event_date > :now and c.hidden_at is null))
             or (u.source_type = 'INDIE_EVENT' and exists (
                select 1 from indie_events e
                where e.id = u.source_id and e.status = 'PUBLISHED' and e.event_date > :now
                  and e.hidden_at is null)))""";

    /**
     * Registra lo sblocco; una seconda volta dalla stessa origine non crea un'altra riga.
     */
    @Modifying(flushAutomatically = true)
    @Query(nativeQuery = true, value = """
            insert into chat_unlocks (conversation_id, source_type, source_id)
            values (:conversationId, cast(:sourceType as chat_unlock_source), :sourceId)
            on conflict do nothing""")
    int insertIfAbsent(UUID conversationId, String sourceType, UUID sourceId);

    /**
     * Se la conversazione ha almeno uno sblocco con l'origine ancora aperta all'istante {@code now}.
     */
    @Query(nativeQuery = true, value = """
            select exists (
                select 1 from chat_unlocks u
                where u.conversation_id = :conversationId and """ + SOURCE_IS_OPEN + ")")
    boolean hasOpenUnlock(UUID conversationId, Instant now);

    /**
     * Fra le conversazioni indicate, quelle con almeno uno sblocco aperto: una sola query per la pagina.
     */
    @Query(nativeQuery = true, value = """
            select distinct u.conversation_id from chat_unlocks u
            where u.conversation_id in (:conversationIds) and """ + SOURCE_IS_OPEN)
    List<UUID> findConversationIdsWithOpenUnlock(Collection<UUID> conversationIds, Instant now);
}

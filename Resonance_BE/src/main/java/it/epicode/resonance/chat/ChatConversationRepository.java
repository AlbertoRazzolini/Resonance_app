package it.epicode.resonance.chat;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

/**
 * Accesso alle conversazioni; la coppia si cerca sempre in ordine canonico (progettazione, sezione 6.9).
 */
public interface ChatConversationRepository extends JpaRepository<ChatConversation, UUID> {

    /**
     * La conversazione della coppia, con i due utenti gia' caricati. Gli id vanno passati in ordine canonico
     * ({@code a < b}).
     */
    @EntityGraph(attributePaths = {"userA", "userB"})
    @Query("select c from ChatConversation c where c.userA.id = :a and c.userB.id = :b")
    Optional<ChatConversation> findByPair(UUID a, UUID b);

    /**
     * La conversazione per id, con i due utenti gia' caricati.
     */
    @EntityGraph(attributePaths = {"userA", "userB"})
    @Query("select c from ChatConversation c where c.id = :id")
    Optional<ChatConversation> findWithUsersById(UUID id);

    /**
     * Le conversazioni dell'utente, dall'ultima attivita' (quelle senza messaggi in fondo), con i due utenti gia'
     * caricati.
     */
    @EntityGraph(attributePaths = {"userA", "userB"})
    @Query(value = """
            select c from ChatConversation c
            where c.userA.id = :me or c.userB.id = :me
            order by c.lastMessageAt desc nulls last, c.id desc""",
            countQuery = "select count(c) from ChatConversation c where c.userA.id = :me or c.userB.id = :me")
    Page<ChatConversation> findForMember(UUID me, Pageable pageable);

    /**
     * Crea la conversazione se la coppia non ne ha gia' una; restituisce 1 se l'ha creata, 0 se esisteva (anche
     * per una creazione concorrente). Gli id vanno passati in ordine canonico.
     */
    @Modifying(flushAutomatically = true)
    @Query(nativeQuery = true, value = """
            insert into chat_conversations (user_a_id, user_b_id) values (:a, :b)
            on conflict (user_a_id, user_b_id) do nothing""")
    int insertIfAbsent(UUID a, UUID b);
}

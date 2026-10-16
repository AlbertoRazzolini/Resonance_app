package it.epicode.resonance.collab;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * Accesso agli annunci di collaborazione.
 */
public interface CollabPostRepository extends JpaRepository<CollabPost, UUID> {

    /**
     * Cerca per id caricando subito l'autore, che serve a ogni risposta. Non filtra i nascosti: lo fa il service.
     */
    @EntityGraph(attributePaths = "musician")
    Optional<CollabPost> findWithMusicianById(UUID id);

    /**
     * Annunci aperti e non nascosti, con l'autore gia' caricato (lista pubblica).
     */
    @EntityGraph(attributePaths = "musician")
    Page<CollabPost> findByOpenTrueAndModerationHiddenAtIsNull(Pageable pageable);
}

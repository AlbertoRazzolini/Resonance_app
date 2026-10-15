package it.epicode.resonance.user.dto;

import it.epicode.resonance.user.User;

import java.util.UUID;

/**
 * Autore di un contenuto (evento, post, annuncio) in forma ridotta: solo cio' che serve a mostrarlo e a
 * rimandare al suo profilo pubblico (progettazione, sezione 6.6).
 */
public record AuthorSummary(UUID id, String displayName, String avatarUrl) {

    /**
     * Riassume un utente: nessun dato privato, nemmeno l'email.
     */
    public static AuthorSummary from(User user) {
        return new AuthorSummary(user.getId(), user.getDisplayName(), user.getAvatarUrl());
    }
}

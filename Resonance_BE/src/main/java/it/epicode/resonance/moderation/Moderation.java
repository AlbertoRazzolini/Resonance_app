package it.epicode.resonance.moderation;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.ToString;

import java.time.Instant;
import java.util.UUID;

/**
 * Stato di moderazione condiviso dai quattro contenuti moderabili (progettazione, sezioni 3.2 e 5.7). Un
 * contenuto e' nascosto se {@code hiddenAt} e' valorizzato; {@code hiddenBy} e' chi l'ha nascosto (il
 * proprietario che lo cancella o un admin che lo modera). Il motivo e' facoltativo per il proprietario e
 * obbligatorio per l'admin: lo controlla il service, non questa classe.
 */
@Embeddable
@ToString
@Getter
public class Moderation {

    @Column(name = "hidden_at")
    private Instant hiddenAt;

    @Column(name = "hidden_by")
    private UUID hiddenBy;

    @Column(name = "hidden_reason")
    private String hiddenReason;

    /**
     * Vero se il contenuto e' nascosto: da escludere da liste e dettagli pubblici (sezione 3.5).
     */
    public boolean isHidden() {
        return hiddenAt != null;
    }

    /**
     * Nasconde il contenuto; il motivo puo' essere nullo (cancellazione del proprietario senza motivo).
     */
    public void hide(UUID by, String reason, Instant at) {
        this.hiddenAt = at;
        this.hiddenBy = by;
        this.hiddenReason = reason;
    }

    /**
     * Rende di nuovo visibile il contenuto, azzerando i tre campi (vincolo ck_*_hidden).
     */
    public void restore() {
        this.hiddenAt = null;
        this.hiddenBy = null;
        this.hiddenReason = null;
    }

    /**
     * Vero se l'ha nascosto l'autore stesso (cancellazione del proprietario, non ripristinabile da un admin,
     * sezione 5.7).
     */
    public boolean hiddenByAuthor(UUID authorId) {
        return hiddenBy != null && hiddenBy.equals(authorId);
    }
}

package it.epicode.resonance.event;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

/**
 * Normalizzazione dei campi di testo comuni alle richieste di concerti e indie event (progettazione, sezione
 * 6.6). Le due entita' restano separate: qui sta solo il codice condiviso dalle richieste.
 */
public final class EventInputNormalizer {

    private EventInputNormalizer() {
    }

    /**
     * Toglie gli spazi ai bordi; null resta null.
     */
    public static String strip(String value) {
        return value == null ? null : value.strip();
    }

    /**
     * Una stringa vuota vale come assente.
     */
    public static String emptyToNull(String value) {
        return value == null || value.isEmpty() ? null : value;
    }

    /**
     * Generi in minuscolo, senza spazi ai bordi e senza duplicati, nell'ordine di arrivo. Un elemento null
     * resta tale (lo segnala la validazione, non un NullPointerException) e un genere di soli spazi diventa
     * vuoto, rifiutato da {@code @Size(min = 1)}.
     */
    public static List<String> normalizeTags(List<String> tags) {
        if (tags == null) {
            return List.of();
        }
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String tag : tags) {
            normalized.add(tag == null ? null : tag.strip().toLowerCase(Locale.ROOT));
        }
        return Collections.unmodifiableList(new ArrayList<>(normalized));
    }
}

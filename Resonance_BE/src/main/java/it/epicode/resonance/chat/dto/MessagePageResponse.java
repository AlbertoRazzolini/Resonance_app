package it.epicode.resonance.chat.dto;

import java.util.List;

/**
 * Una pagina dello storico a cursore (progettazione, sezione 6.9): dal messaggio piu' recente; {@code hasMore}
 * dice se ce ne sono di piu' vecchi. Per la pagina successiva si passa come {@code before} l'id dell'ultimo
 * messaggio della lista.
 */
public record MessagePageResponse(List<ChatMessageResponse> messages, boolean hasMore) {
}

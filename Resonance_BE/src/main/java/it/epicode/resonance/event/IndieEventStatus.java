package it.epicode.resonance.event;

/**
 * Stato di un indie event (progettazione, sezione 3.1): una bozza e' visibile solo al proprietario, un evento
 * pubblicato anche agli altri. Corrisponde all'enum PostgreSQL {@code indie_event_status}.
 */
public enum IndieEventStatus {
    DRAFT,
    PUBLISHED
}

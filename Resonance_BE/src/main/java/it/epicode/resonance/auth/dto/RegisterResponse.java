package it.epicode.resonance.auth.dto;

/**
 * Risposta della registrazione: solo l'email, senza l'id utente (progettazione, sezione 4.4 e decisione 49).
 * Al client serve solo per mostrare dove e' arrivato il codice e per la verifica.
 */
public record RegisterResponse(String email) {
}

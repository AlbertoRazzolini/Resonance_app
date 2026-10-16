package it.epicode.resonance.chat;

/**
 * Origine di uno sblocco: cio' che ha messo in contatto due utenti non amici (progettazione, sezione 6.9). Lo
 * sblocco vale finche' l'origine e' aperta.
 */
public enum ChatUnlockSource {
    COLLAB_POST,
    OFFICIAL_CONCERT,
    INDIE_EVENT
}

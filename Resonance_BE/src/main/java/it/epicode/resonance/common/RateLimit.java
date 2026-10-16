package it.epicode.resonance.common;

/**
 * I limiti di frequenza in memoria (progettazione, sezione 8.8). I valori stanno in application.yml
 * sotto app.rate-limits, con il nome in minuscolo e i trattini (LOGIN_FAILED -> login-failed). I
 * limiti sui codici via email non sono qui: stanno nel database (progettazione, sezione 4.6).
 */
public enum RateLimit {
    LOGIN_FAILED,
    CHAT_MESSAGES,
    CONVERSATIONS_CREATED,
    COLLAB_APPLICATIONS,
    FRIEND_REQUESTS,
    USER_SEARCH;

    /**
     * Nome della chiave di configurazione sotto app.rate-limits.
     */
    public String configKey() {
        return name().toLowerCase().replace('_', '-');
    }
}

package it.epicode.resonance.moderation;

/**
 * Tipi di contenuto moderabili (progettazione, sezione 5.7). {@code path} e' il segmento usato negli URL
 * di moderazione dell'admin.
 */
public enum ModeratedContentType {

    OFFICIAL_CONCERT("official-concerts"),
    INDIE_EVENT("indie-events"),
    FEED_POST("feed-posts"),
    COLLAB_POST("collab-posts");

    private final String path;

    ModeratedContentType(String path) {
        this.path = path;
    }

    public String path() {
        return path;
    }
}

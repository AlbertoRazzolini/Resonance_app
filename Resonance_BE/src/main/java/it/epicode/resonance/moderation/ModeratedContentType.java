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

    /**
     * Tipo dal segmento dell'URL; un valore sconosciuto lancia IllegalArgumentException, che diventa un 400.
     */
    public static ModeratedContentType fromPath(String path) {
        for (ModeratedContentType type : values()) {
            if (type.path.equals(path)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Tipo di contenuto sconosciuto: " + path);
    }
}

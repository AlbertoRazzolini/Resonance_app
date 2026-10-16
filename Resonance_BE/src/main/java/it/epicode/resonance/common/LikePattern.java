package it.epicode.resonance.common;

/**
 * Utilita' per i pattern del LIKE, condivisa dalle ricerche testuali (elenco admin, ricerca utenti).
 */
public final class LikePattern {

    private LikePattern() {
    }

    /**
     * Rende letterali i caratteri speciali del LIKE (\, % e _), cosi' la ricerca non puo' usarli come jolly.
     * Il backslash si raddoppia per primo, altrimenti si raddoppierebbero anche quelli aggiunti per gli altri due.
     * Non e' una difesa dalla SQL injection, che i parametri gia' garantiscono (progettazione, sezione 8.6).
     */
    public static String escape(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}

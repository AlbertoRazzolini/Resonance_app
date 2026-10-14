package it.epicode.resonance.config;

import java.net.URI;

/**
 * Render consegna il database in una variabile sola, DATABASE_URL, scritta cosi':
 *
 *     postgresql://utente:password@host:5432/nome_db
 *
 * Il driver JDBC pretende invece tre informazioni separate e un indirizzo che comincia con
 * jdbc:postgresql://, senza credenziali dentro. Spring Boot non interpreta DATABASE_URL:
 * la conversione si fa qui e il risultato va nelle system property, che hanno la precedenza
 * su application.yml (progettazione, sezione 12.3). In locale la variabile non esiste, il metodo
 * non fa niente e restano validi i valori dei profili.
 */
public final class DatabaseUrl {

    private DatabaseUrl() {
    }

    /**
     * Legge DATABASE_URL dall'ambiente e, se c'e', imposta le proprieta' del datasource.
     */
    public static void applyIfPresent() {
        apply(System.getenv("DATABASE_URL"));
    }

    /**
     * Traduce il valore grezzo di DATABASE_URL in URL, utente e password del datasource.
     * Non fa niente se il valore e' nullo o vuoto; non stampa mai la password.
     */
    static void apply(String raw) {
        if (raw == null || raw.isBlank()) {
            return;
        }
        String jdbc = toJdbc(raw);
        System.setProperty("spring.datasource.url", jdbc);
        if (raw.startsWith("jdbc:")) {
            // Gia' nel formato giusto: credenziali, se servono, restano nelle altre variabili.
            return;
        }

        String[] credentials = credentials(raw);
        if (credentials.length > 0) {
            System.setProperty("spring.datasource.username", credentials[0]);
        }
        if (credentials.length > 1) {
            System.setProperty("spring.datasource.password", credentials[1]);
        }

        // La password non si stampa mai: i log di Render sono leggibili da chiunque abbia accesso al progetto.
        System.out.println("[database] DATABASE_URL tradotta in " + jdbc);
    }

    /**
     * Converte l'URL di Render in un URL JDBC senza credenziali. Un URL gia' jdbc: resta com'e'.
     */
    static String toJdbc(String raw) {
        String trimmed = raw.trim();
        if (trimmed.startsWith("jdbc:")) {
            return trimmed;
        }
        URI uri = URI.create(trimmed);
        int port = uri.getPort() == -1 ? 5432 : uri.getPort();
        // sslmode=require: la connessione interna di Render non lo chiederebbe, quella esterna si',
        // e lo stesso indirizzo va bene in entrambi i casi.
        return "jdbc:postgresql://%s:%d%s?sslmode=require".formatted(uri.getHost(), port, uri.getPath());
    }

    /**
     * Estrae utente e password dall'URL; l'array e' vuoto se mancano.
     */
    private static String[] credentials(String raw) {
        String userInfo = URI.create(raw.trim()).getUserInfo();
        return userInfo == null ? new String[0] : userInfo.split(":", 2);
    }
}

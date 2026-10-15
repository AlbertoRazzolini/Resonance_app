package it.epicode.resonance.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

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
        // Neppure se qualcuno l'avesse messa fra i parametri dell'URL (password=...).
        System.out.println("[database] DATABASE_URL tradotta in " + jdbc.replaceAll("(?i)(password=)[^&]*", "$1***"));
    }

    /**
     * Converte l'URL di Render in un URL JDBC senza credenziali, mantenendo i parametri gia' presenti
     * (decisione 52): quello esterno di Render ha sslmode=require, quello interno non ha parametri e il suo
     * server non offre TLS, quindi non si aggiunge niente. Un URL gia' jdbc: resta com'e'.
     */
    static String toJdbc(String raw) {
        String trimmed = raw.trim();
        if (trimmed.startsWith("jdbc:")) {
            return trimmed;
        }
        URI uri = parse(trimmed);
        int port = uri.getPort() == -1 ? 5432 : uri.getPort();
        String query = uri.getRawQuery();
        return "jdbc:postgresql://%s:%d%s%s".formatted(uri.getHost(), port, uri.getPath(),
                query == null || query.isEmpty() ? "" : "?" + query);
    }

    /**
     * Estrae utente e password dall'URL, gia' decodificati (%40 diventa "@"): il driver JDBC li vuole in chiaro.
     * Si divide sul primo ":" della parte grezza, prima di decodificare, cosi' un ":" codificato (%3A) fa
     * parte del nome o della password e non e' il separatore. L'array e' vuoto se mancano.
     */
    private static String[] credentials(String raw) {
        String userInfo = parse(raw.trim()).getRawUserInfo();
        if (userInfo == null) {
            return new String[0];
        }
        return Arrays.stream(userInfo.split(":", 2)).map(DatabaseUrl::decode).toArray(String[]::new);
    }

    /**
     * Legge l'URL. Se non e' valido (per esempio una "%" non codificata nella password) lancia un errore con
     * messaggio fisso e senza la causa: l'eccezione di {@link URI#create} riporta l'URL intero, password
     * compresa, che finirebbe nello stack trace dell'avvio e nei log di Render (progettazione, sezione 8.9).
     */
    private static URI parse(String url) {
        try {
            return URI.create(url);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("DATABASE_URL non valido");
        }
    }

    /**
     * Decodifica i %xx. Il "+" resta tale (URLDecoder lo trasformerebbe in spazio): qui non e' una query string.
     */
    private static String decode(String value) {
        return URLDecoder.decode(value.replace("+", "%2B"), StandardCharsets.UTF_8);
    }
}

package it.epicode.resonance.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;

/**
 * Conversione di DATABASE_URL di Render in URL JDBC e in proprieta' del datasource
 * (progettazione, sezione 12.3): i parametri dell'URL restano quelli di Render, senza sslmode aggiunto
 * (decisione 52).
 */
class DatabaseUrlTest {

    // Le system property sono globali alla JVM: si ripuliscono per non influenzare gli altri test.
    @AfterEach
    void clearSystemProperties() {
        System.clearProperty("spring.datasource.url");
        System.clearProperty("spring.datasource.username");
        System.clearProperty("spring.datasource.password");
    }

    // L'URL interno di Render non ha parametri e il suo server non offre TLS: forzare sslmode lo romperebbe
    // (decisione 52).
    @Test
    void toJdbc_internalUrlWithoutParameters_getsNoSslmode() {
        assertThat(DatabaseUrl.toJdbc("postgresql://u:p@host:5432/db"))
                .isEqualTo("jdbc:postgresql://host:5432/db");
    }

    @Test
    void toJdbc_externalUrlWithSslmodeRequire_keepsIt() {
        assertThat(DatabaseUrl.toJdbc("postgresql://u:p@host.render.com:5432/db?sslmode=require"))
                .isEqualTo("jdbc:postgresql://host.render.com:5432/db?sslmode=require");
    }

    @Test
    void toJdbc_keepsOtherParametersInTheirOrder() {
        assertThat(DatabaseUrl.toJdbc("postgresql://u:p@host:5432/db?sslmode=require&connectTimeout=5&application_name=resonance"))
                .isEqualTo("jdbc:postgresql://host:5432/db?sslmode=require&connectTimeout=5&application_name=resonance");
    }

    @Test
    void toJdbc_keepsParametersThatAreNotSslmode() {
        assertThat(DatabaseUrl.toJdbc("postgresql://u:p@host:5432/db?connectTimeout=5"))
                .isEqualTo("jdbc:postgresql://host:5432/db?connectTimeout=5");
    }

    @Test
    void toJdbc_acceptsThePostgresScheme() {
        assertThat(DatabaseUrl.toJdbc("postgres://u:p@host:5432/db"))
                .isEqualTo("jdbc:postgresql://host:5432/db");
    }

    @Test
    void toJdbc_defaultsToPort5432WhenMissing() {
        assertThat(DatabaseUrl.toJdbc("postgresql://u:p@host/db"))
                .isEqualTo("jdbc:postgresql://host:5432/db");
    }

    @Test
    void toJdbc_keepsJdbcUrlUnchanged() {
        assertThat(DatabaseUrl.toJdbc("jdbc:postgresql://localhost:5433/resonance"))
                .isEqualTo("jdbc:postgresql://localhost:5433/resonance");
    }

    @Test
    void toJdbc_doesNotContainCredentials() {
        assertThat(DatabaseUrl.toJdbc("postgresql://mario:segreto@host:5432/db?sslmode=require"))
                .doesNotContain("mario")
                .doesNotContain("segreto");
    }

    @Test
    void apply_setsPropertiesAndNeverPrintsPassword() {
        // Si cattura System.out: la password non deve comparire nei log (progettazione, sezione 8.9).
        PrintStream originalOut = System.out;
        ByteArrayOutputStream captured = new ByteArrayOutputStream();
        System.setOut(new PrintStream(captured, true));
        try {
            DatabaseUrl.apply("postgresql://mario:segreto@host:5432/db");
        } finally {
            System.setOut(originalOut);
        }

        assertThat(System.getProperty("spring.datasource.url")).isEqualTo("jdbc:postgresql://host:5432/db");
        assertThat(System.getProperty("spring.datasource.username")).isEqualTo("mario");
        assertThat(System.getProperty("spring.datasource.password")).isEqualTo("segreto");
        assertThat(captured.toString()).doesNotContain("segreto");
    }

    @Test
    void apply_withParameters_keepsThemAndNeverPrintsPassword() {
        PrintStream originalOut = System.out;
        ByteArrayOutputStream captured = new ByteArrayOutputStream();
        System.setOut(new PrintStream(captured, true));
        try {
            DatabaseUrl.apply("postgresql://mario:segreto@host:5432/db?sslmode=require");
        } finally {
            System.setOut(originalOut);
        }

        assertThat(System.getProperty("spring.datasource.url"))
                .isEqualTo("jdbc:postgresql://host:5432/db?sslmode=require");
        assertThat(System.getProperty("spring.datasource.password")).isEqualTo("segreto");
        assertThat(captured.toString()).contains("sslmode=require").doesNotContain("segreto").doesNotContain("mario");
    }

    @Test
    void apply_neverPrintsAPasswordPassedAsAParameter() {
        PrintStream originalOut = System.out;
        ByteArrayOutputStream captured = new ByteArrayOutputStream();
        System.setOut(new PrintStream(captured, true));
        try {
            DatabaseUrl.apply("postgresql://mario@host:5432/db?sslmode=require&password=segreto");
        } finally {
            System.setOut(originalOut);
        }

        assertThat(captured.toString()).contains("sslmode=require").doesNotContain("segreto");
    }

    // Il driver JDBC vuole utente e password decodificati: %40 e' "@", %3A e' ":", %2B e' "+".
    @Test
    void apply_decodesPercentEncodedPassword() {
        DatabaseUrl.apply("postgresql://mario:p%40ss%3Aw%2Bord%25@host:5432/db");

        assertThat(System.getProperty("spring.datasource.username")).isEqualTo("mario");
        assertThat(System.getProperty("spring.datasource.password")).isEqualTo("p@ss:w+ord%");
        assertThat(System.getProperty("spring.datasource.url")).isEqualTo("jdbc:postgresql://host:5432/db");
    }

    @Test
    void apply_decodesPercentEncodedUsernameEvenWithAColon() {
        // I due punti codificati nell'utente non sono il separatore con la password.
        DatabaseUrl.apply("postgresql://ma%40rio%3Arossi:segreto@host:5432/db");

        assertThat(System.getProperty("spring.datasource.username")).isEqualTo("ma@rio:rossi");
        assertThat(System.getProperty("spring.datasource.password")).isEqualTo("segreto");
    }

    @Test
    void apply_keepsAPlusSignInThePassword() {
        // Un "+" letterale non e' uno spazio: non e' una query string.
        DatabaseUrl.apply("postgresql://mario:a+b@host:5432/db");

        assertThat(System.getProperty("spring.datasource.password")).isEqualTo("a+b");
    }

    @Test
    void apply_neverPrintsAnEncodedOrDecodedPassword() {
        PrintStream originalOut = System.out;
        ByteArrayOutputStream captured = new ByteArrayOutputStream();
        System.setOut(new PrintStream(captured, true));
        try {
            DatabaseUrl.apply("postgresql://mario:p%40ss%3Aword@host:5432/db");
        } finally {
            System.setOut(originalOut);
        }

        assertThat(captured.toString()).doesNotContain("p%40ss").doesNotContain("p@ss").doesNotContain("ss:word");
    }

    // Una "%" non codificata rende l'URL non valido. L'errore non deve riportare l'input, che contiene la password
    // (progettazione, sezione 8.9): ne' nel messaggio, ne' nella causa, ne' sull'output.
    @Test
    void apply_withAnInvalidUrl_failsWithAFixedMessageThatDoesNotContainThePasswordOrTheUrl() {
        String url = "postgresql://mario:Segreto%RICONOSCIBILE@host:5432/db";
        PrintStream originalOut = System.out;
        PrintStream originalErr = System.err;
        ByteArrayOutputStream captured = new ByteArrayOutputStream();
        System.setOut(new PrintStream(captured, true));
        System.setErr(new PrintStream(captured, true));
        Throwable thrown;
        try {
            thrown = catchThrowable(() -> DatabaseUrl.apply(url));
        } finally {
            System.setOut(originalOut);
            System.setErr(originalErr);
        }

        assertThat(thrown).isInstanceOf(IllegalStateException.class).hasMessage("DATABASE_URL non valido");
        // Né il messaggio né la catena delle cause (l'eccezione originale riporta l'input intero).
        for (Throwable t = thrown; t != null; t = t.getCause()) {
            assertThat(String.valueOf(t.getMessage())).doesNotContain("RICONOSCIBILE").doesNotContain("mario")
                    .doesNotContain(url);
        }
        assertThat(captured.toString()).doesNotContain("RICONOSCIBILE").doesNotContain(url);
        // Nessuna proprietà impostata a meta'.
        assertThat(System.getProperty("spring.datasource.url")).isNull();
        assertThat(System.getProperty("spring.datasource.password")).isNull();
    }

    @Test
    void toJdbc_withAnInvalidUrl_failsWithAFixedMessage() {
        assertThatThrownBy(() -> DatabaseUrl.toJdbc("postgresql://mario:Segreto%RICONOSCIBILE@host:5432/db"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("DATABASE_URL non valido");
    }

    @Test
    void apply_doesNothingWhenVariableIsMissing() {
        DatabaseUrl.apply(null);
        DatabaseUrl.apply("  ");

        assertThat(System.getProperty("spring.datasource.url")).isNull();
    }
}

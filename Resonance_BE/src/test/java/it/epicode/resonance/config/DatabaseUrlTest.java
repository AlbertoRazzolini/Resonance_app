package it.epicode.resonance.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;

import static org.assertj.core.api.Assertions.assertThat;

class DatabaseUrlTest {

    @AfterEach
    void clearSystemProperties() {
        System.clearProperty("spring.datasource.url");
        System.clearProperty("spring.datasource.username");
        System.clearProperty("spring.datasource.password");
    }

    @Test
    void toJdbc_convertsRenderUrlAndRequiresSsl() {
        assertThat(DatabaseUrl.toJdbc("postgresql://u:p@host:5432/db"))
                .isEqualTo("jdbc:postgresql://host:5432/db?sslmode=require");
    }

    @Test
    void toJdbc_defaultsToPort5432WhenMissing() {
        assertThat(DatabaseUrl.toJdbc("postgresql://u:p@host/db"))
                .isEqualTo("jdbc:postgresql://host:5432/db?sslmode=require");
    }

    @Test
    void toJdbc_keepsJdbcUrlUnchanged() {
        assertThat(DatabaseUrl.toJdbc("jdbc:postgresql://localhost:5433/resonance"))
                .isEqualTo("jdbc:postgresql://localhost:5433/resonance");
    }

    @Test
    void toJdbc_doesNotContainCredentials() {
        assertThat(DatabaseUrl.toJdbc("postgresql://mario:segreto@host:5432/db"))
                .doesNotContain("mario")
                .doesNotContain("segreto");
    }

    @Test
    void apply_setsPropertiesAndNeverPrintsPassword() {
        PrintStream originalOut = System.out;
        ByteArrayOutputStream captured = new ByteArrayOutputStream();
        System.setOut(new PrintStream(captured, true));
        try {
            DatabaseUrl.apply("postgresql://mario:segreto@host:5432/db");
        } finally {
            System.setOut(originalOut);
        }

        assertThat(System.getProperty("spring.datasource.url"))
                .isEqualTo("jdbc:postgresql://host:5432/db?sslmode=require");
        assertThat(System.getProperty("spring.datasource.username")).isEqualTo("mario");
        assertThat(System.getProperty("spring.datasource.password")).isEqualTo("segreto");
        assertThat(captured.toString()).doesNotContain("segreto");
    }

    @Test
    void apply_doesNothingWhenVariableIsMissing() {
        DatabaseUrl.apply(null);
        DatabaseUrl.apply("  ");

        assertThat(System.getProperty("spring.datasource.url")).isNull();
    }
}

package it.epicode.resonance.user;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pulizia del nome utente prima di validarlo e salvarlo (decisione 96): trim ai bordi e spazi ripetuti ridotti a uno.
 */
class DisplayNamesTest {

    @Test
    void normalize_collapsesRepeatedSpacesIntoOne() {
        assertThat(DisplayNames.normalize("Marco   Rossi")).isEqualTo("Marco Rossi");
        assertThat(DisplayNames.normalize("A  B   C    D")).isEqualTo("A B C D");
    }

    @Test
    void normalize_stripsTheEdges() {
        assertThat(DisplayNames.normalize("  Marco Rossi  ")).isEqualTo("Marco Rossi");
    }

    @Test
    void normalize_leavesASingleSpaceAndNamesWithoutSpacesUnchanged() {
        assertThat(DisplayNames.normalize("Marco Rossi")).isEqualTo("Marco Rossi");
        assertThat(DisplayNames.normalize("AC/DC")).isEqualTo("AC/DC");
    }

    @Test
    void normalize_keepsTheCaseAsTyped() {
        assertThat(DisplayNames.normalize("MaRcO  RoSsI")).isEqualTo("MaRcO RoSsI");
    }

    @Test
    void normalize_ofBlankOrNull() {
        assertThat(DisplayNames.normalize("     ")).isEmpty();
        assertThat(DisplayNames.normalize(null)).isNull();
    }
}

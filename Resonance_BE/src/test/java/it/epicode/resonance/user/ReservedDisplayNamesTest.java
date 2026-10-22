package it.epicode.resonance.user;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Nomi riservati (decisione 96): rifiutati solo se il nome intero coincide con uno dell'elenco, senza distinguere
 * le maiuscole. Un nome che contiene una parola riservata, o la divide con spazi, e' un altro nome.
 */
class ReservedDisplayNamesTest {

    @ParameterizedTest
    @ValueSource(strings = {"admin", "superadmin", "resonance", "staff", "support", "moderator", "official",
            "system", "root"})
    void isReserved_trueForEveryNameOfTheList(String name) {
        assertThat(ReservedDisplayNames.isReserved(name)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"ADMIN", "Admin", "SuperAdmin", "RESONANCE", "Root"})
    void isReserved_ignoresTheCase(String name) {
        assertThat(ReservedDisplayNames.isReserved(name)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Admin Mario", "resonance_ufficiale", "Radmin", "Super Admin", "Systemic", "Mario"})
    void isReserved_falseWhenTheWholeNameIsDifferent(String name) {
        // Limite noto: "Admin Mario" passa (decisione 96, alternativa "contenuti nel nome" scartata).
        assertThat(ReservedDisplayNames.isReserved(name)).isFalse();
    }

    @Test
    void isReserved_falseForNull() {
        assertThat(ReservedDisplayNames.isReserved(null)).isFalse();
    }
}

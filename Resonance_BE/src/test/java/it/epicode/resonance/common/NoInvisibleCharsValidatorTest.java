package it.epicode.resonance.common;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * @NoInvisibleChars rifiuta caratteri di controllo, di formato (spazi a larghezza zero, inversione del testo) e
 * separatori di riga o paragrafo, che permettono nomi uguali a vista ma diversi (progettazione, sezione 6.5;
 * decisione 84). Gli spazi normali restano ammessi.
 */
class NoInvisibleCharsValidatorTest {

    private record Dto(@NoInvisibleChars String value) {
    }

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private boolean isValid(String value) {
        return validator.validate(new Dto(value)).isEmpty();
    }

    @Test
    void visibleText_isValid() {
        assertThat(isValid("Mario Rossi")).isTrue();
        assertThat(isValid("Zoë Società")).isTrue();
        assertThat(isValid("漢字 Привет")).isTrue();
        assertThat(isValid("Post-Nebbia  Live Club")).isTrue();
    }

    @Test
    void nullAndBlank_areValid() {
        assertThat(isValid(null)).isTrue();
        assertThat(isValid("")).isTrue();
        assertThat(isValid("   ")).isTrue();
    }

    @Test
    void zeroWidthSpace_isRejected() {
        assertThat(isValid("Mario​Rossi")).isFalse();
    }

    @Test
    void textDirectionOverride_isRejected() {
        // U+202E inverte il verso del testo: "Mario" potrebbe sembrare un altro nome.
        assertThat(isValid("Mario‮oiram")).isFalse();
    }

    @Test
    void otherFormatCharacters_areRejected() {
        assertThat(isValid("Mario‍Rossi")).isFalse();
        assertThat(isValid("﻿Mario")).isFalse();
        assertThat(isValid("Mar­io")).isFalse();
    }

    @Test
    void controlCharacters_areRejected() {
        assertThat(isValid("Mario\nRossi")).isFalse();
        assertThat(isValid("Mario\tRossi")).isFalse();
        assertThat(isValid("Mario\u0000Rossi")).isFalse();
    }

    @Test
    void lineAndParagraphSeparators_areRejected() {
        assertThat(isValid("Mario Rossi")).isFalse();
        assertThat(isValid("Mario Rossi")).isFalse();
    }
}

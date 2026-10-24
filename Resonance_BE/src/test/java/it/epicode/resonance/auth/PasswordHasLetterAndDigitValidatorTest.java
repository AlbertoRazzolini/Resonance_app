package it.epicode.resonance.auth;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * @PasswordHasLetterAndDigit richiede almeno una lettera e almeno una cifra (decisione 113, prova dinamica
 * F7-07): accetta chi ha entrambi, anche con lettere accentate o non latine, e rifiuta chi ha solo lettere o
 * solo cifre.
 */
class PasswordHasLetterAndDigitValidatorTest {

    private record Dto(@PasswordHasLetterAndDigit String value) {
    }

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private boolean isValid(String value) {
        return validator.validate(new Dto(value)).isEmpty();
    }

    @Test
    void letterAndDigit_isValid() {
        assertThat(isValid("password1")).isTrue();
        assertThat(isValid("1password")).isTrue();
        assertThat(isValid("p4ssw0rd")).isTrue();
        // Lettera accentata o non latina più una cifra: @NoEmoji resta il controllo sulle emoji, non questo.
        assertThat(isValid("pässwörd1")).isTrue();
        assertThat(isValid("пароль1")).isTrue();
    }

    @Test
    void onlyLetters_isRejected() {
        assertThat(isValid("passwordsenzacifre")).isFalse();
    }

    @Test
    void onlyDigits_isRejected() {
        assertThat(isValid("12345678")).isFalse();
    }

    @Test
    void nullAndBlank_areValid() {
        // La presenza la controlla @NotBlank dove serve.
        assertThat(isValid(null)).isTrue();
        assertThat(isValid("")).isTrue();
        assertThat(isValid("   ")).isTrue();
    }
}

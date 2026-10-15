package it.epicode.resonance.common;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * @NotBlankIfPresent per i campi obbligatori dei PATCH: assente (null) va bene, presente deve avere
 * almeno un carattere che non sia uno spazio (progettazione, sezione 6.1).
 */
class NotBlankIfPresentTest {

    private record Dto(@NotBlankIfPresent String displayName) {
    }

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private boolean isValid(String value) {
        return validator.validate(new Dto(value)).isEmpty();
    }

    @Test
    void null_isValid() {
        assertThat(isValid(null)).isTrue();
    }

    @Test
    void textWithAtLeastOneCharacter_isValid() {
        assertThat(isValid("Mario")).isTrue();
        assertThat(isValid("  Mario  ")).isTrue();
    }

    @Test
    void emptyOrBlankText_isRejected() {
        assertThat(isValid("")).isFalse();
        assertThat(isValid("   ")).isFalse();
        assertThat(isValid("\n\t")).isFalse();
    }

    @Test
    void violation_hasASingleMessage() {
        var violations = validator.validate(new Dto("  "));

        assertThat(violations).hasSize(1);
        assertThat(violations.iterator().next().getMessage()).isEqualTo("non deve essere vuoto");
    }
}

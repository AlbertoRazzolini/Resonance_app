package it.epicode.resonance.common;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * @NoEmoji rifiuta emoji, modificatori, bandiere, sequenze con ZWJ e selettore emoji (progettazione, sezioni 4.4 e 6.4;
 * decisione 84) e lascia passare lettere accentate, cifre, punteggiatura e scritture non latine.
 */
class NoEmojiValidatorTest {

    private record Dto(@NoEmoji String value) {
    }

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private boolean isValid(String value) {
        return validator.validate(new Dto(value)).isEmpty();
    }

    @Test
    void plainText_isValid() {
        assertThat(isValid("Mario Rossi")).isTrue();
        assertThat(isValid("Società Perché è già così")).isTrue();
        assertThat(isValid("Zoë")).isTrue();
        assertThat(isValid("漢字 Привет")).isTrue();
        assertThat(isValid("Post-Nebbia Live Club!")).isTrue();
        assertThat(isValid("AC/DC")).isTrue();
    }

    @Test
    void passwordCharacters_areValid() {
        // Cifre, # e * sono "emoji" per Unicode solo come base di una sequenza (il tasto con cornice): da sole sono testo normale.
        assertThat(isValid("12345678")).isTrue();
        assertThat(isValid("Test #1 * P@ss w0rd!?")).isTrue();
    }

    @Test
    void nullAndBlank_areValid() {
        // La presenza la controlla @NotBlank dove serve.
        assertThat(isValid(null)).isTrue();
        assertThat(isValid("")).isTrue();
        assertThat(isValid("   ")).isTrue();
    }

    @Test
    void simpleEmoji_isRejected() {
        assertThat(isValid("🎸")).isFalse();
        assertThat(isValid("Mario 🎸")).isFalse();
        assertThat(isValid("🎸 Mario")).isFalse();
        assertThat(isValid("a😀b")).isFalse();
    }

    @Test
    void emojiWithSkinToneModifier_isRejected() {
        assertThat(isValid("👍🏽")).isFalse();
    }

    @Test
    void flag_isRejected() {
        // Una bandiera sono due indicatori regionali, che non sono emoji grafiche da soli.
        assertThat(isValid("🇮🇹")).isFalse();
    }

    @Test
    void zwjSequence_isRejected() {
        assertThat(isValid("👨\u200D👩\u200D👧")).isFalse();
    }

    @Test
    void emojiSelector_isRejected() {
        assertThat(isValid("❤\uFE0F")).isFalse();
        // Tasto 1 in cornice: cifra + selettore + cornice, senza nessuna emoji grafica.
        assertThat(isValid("1\uFE0F\u20E3")).isFalse();
    }

    @Test
    void symbolsThatUnicodeTreatsAsEmoji_areRejected() {
        // © ® ™ sono Extended_Pictographic: bloccati di proposito (decisione 84).
        assertThat(isValid("©")).isFalse();
        assertThat(isValid("®")).isFalse();
        assertThat(isValid("™")).isFalse();
    }

    @Test
    void thirtyEmoji_areRejected() {
        // Review focus 2: 30 emoji sono 120 byte; oltre al limite dei byte, ora sono rifiutate anche come emoji.
        assertThat(isValid("😀".repeat(30))).isFalse();
    }
}

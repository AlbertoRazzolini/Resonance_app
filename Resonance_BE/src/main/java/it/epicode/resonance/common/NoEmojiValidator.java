package it.epicode.resonance.common;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * Validatore di {@link NoEmoji}: rifiuta ogni punto di codice emoji (grafico, modificatore di colore, indicatore di
 * bandiera, selettore U+FE0F, collante ZWJ U+200D). Cifre, # e * non contano: sono emoji solo come base di una
 * sequenza, e la sequenza si riconosce dal selettore.
 */
public class NoEmojiValidator implements ConstraintValidator<NoEmoji, String> {

    private static final int REGIONAL_INDICATOR_FIRST = 0x1F1E6;
    private static final int REGIONAL_INDICATOR_LAST = 0x1F1FF;
    private static final int EMOJI_SELECTOR = 0xFE0F;
    private static final int ZERO_WIDTH_JOINER = 0x200D;

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        // Il valore nullo e' compito di @NotBlank.
        return value == null || value.codePoints().noneMatch(NoEmojiValidator::isEmoji);
    }

    private static boolean isEmoji(int codePoint) {
        return Character.isExtendedPictographic(codePoint)
                || Character.isEmojiPresentation(codePoint)
                || Character.isEmojiModifier(codePoint)
                || (codePoint >= REGIONAL_INDICATOR_FIRST && codePoint <= REGIONAL_INDICATOR_LAST)
                || codePoint == EMOJI_SELECTOR
                || codePoint == ZERO_WIDTH_JOINER;
    }
}

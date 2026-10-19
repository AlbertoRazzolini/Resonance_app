package it.epicode.resonance.common;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * Validatore di {@link NoInvisibleChars}: rifiuta i caratteri di controllo (Cc), di formato (Cf: spazi a larghezza
 * zero, inversione del testo, soft hyphen) e i separatori di riga e paragrafo (Zl, Zp). Lo spazio normale (Zs) resta
 * ammesso.
 */
public class NoInvisibleCharsValidator implements ConstraintValidator<NoInvisibleChars, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        // Il valore nullo e' compito di @NotBlank.
        return value == null || value.codePoints().noneMatch(NoInvisibleCharsValidator::isInvisible);
    }

    private static boolean isInvisible(int codePoint) {
        int type = Character.getType(codePoint);
        return type == Character.CONTROL
                || type == Character.FORMAT
                || type == Character.LINE_SEPARATOR
                || type == Character.PARAGRAPH_SEPARATOR;
    }
}

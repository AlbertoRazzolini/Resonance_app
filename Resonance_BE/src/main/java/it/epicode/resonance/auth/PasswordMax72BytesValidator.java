package it.epicode.resonance.auth;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.nio.charset.StandardCharsets;

/**
 * Validatore di {@link PasswordMax72Bytes}. Il controllo e' anche un metodo statico, usato dal login e dalla
 * verifica per le password da confrontare.
 */
public class PasswordMax72BytesValidator implements ConstraintValidator<PasswordMax72Bytes, String> {

    // BCrypt legge al massimo 72 byte: oltre, la password non puo' essere quella registrata.
    private static final int MAX_BYTES = 72;

    /**
     * Dice se la password supera i 72 byte in UTF-8.
     */
    public static boolean exceedsLimit(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES;
    }

    @Override
    public boolean isValid(String password, ConstraintValidatorContext context) {
        // Il valore nullo e' compito di @NotBlank.
        return password == null || !exceedsLimit(password);
    }
}

package it.epicode.resonance.auth;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * Validatore di {@link PasswordHasLetterAndDigit}. Il controllo e' anche un metodo statico, usato dal
 * bootstrap del SUPERADMIN, che non passa dalla validazione dei DTO.
 */
public class PasswordHasLetterAndDigitValidator implements ConstraintValidator<PasswordHasLetterAndDigit, String> {

    /**
     * Dice se la password ha almeno una lettera (di qualunque alfabeto) e almeno una cifra.
     */
    public static boolean hasLetterAndDigit(String password) {
        boolean letter = false;
        boolean digit = false;
        for (int i = 0; i < password.length() && !(letter && digit); i++) {
            char c = password.charAt(i);
            letter |= Character.isLetter(c);
            digit |= Character.isDigit(c);
        }
        return letter && digit;
    }

    @Override
    public boolean isValid(String password, ConstraintValidatorContext context) {
        // Il valore nullo e' compito di @NotBlank; una stringa vuota o di soli spazi non ha ne' lettere ne' cifre
        // ma lo segnala gia' @Size, quindi qui resta valida per non duplicare il messaggio.
        return password == null || password.isBlank() || hasLetterAndDigit(password);
    }
}

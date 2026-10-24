package it.epicode.resonance.auth;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Password NUOVA (registrazione, reset): almeno una lettera e almeno una cifra, oltre al limite di lunghezza
 * di {@code @Size} (decisione 113, dalla prova dinamica F7-07). Le password da CONTROLLARE non usano questa
 * annotazione, come {@link PasswordMax72Bytes}.
 */
@Documented
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = PasswordHasLetterAndDigitValidator.class)
public @interface PasswordHasLetterAndDigit {

    String message() default "deve contenere almeno una lettera e un numero";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}

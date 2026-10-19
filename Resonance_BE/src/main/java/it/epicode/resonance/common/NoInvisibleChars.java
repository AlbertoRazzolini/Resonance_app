package it.epicode.resonance.common;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Il valore non deve contenere caratteri invisibili (decisione 84): controllo, formato e separatori di riga o
 * paragrafo. Gli spazi normali sono ammessi. Null e stringa vuota sono validi.
 */
@Documented
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = NoInvisibleCharsValidator.class)
public @interface NoInvisibleChars {

    String message() default "non può contenere caratteri invisibili";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}

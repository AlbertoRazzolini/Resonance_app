package it.epicode.resonance.common;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Il valore non deve contenere emoji (decisione 84): vale per il nome e per le NUOVE password (registrazione, reset),
 * mai per le password da confrontare (login, verifica). Null e stringa vuota sono validi.
 */
@Documented
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = NoEmojiValidator.class)
public @interface NoEmoji {

    String message() default "non può contenere emoji";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}

package it.epicode.resonance.common;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Il valore, se presente, deve essere un URL http o https di al massimo 2048 caratteri: blocca
 * javascript: e gli altri schemi (progettazione, sezione 8.6). Null e stringa vuota sono validi.
 */
@Documented
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = HttpUrlValidator.class)
public @interface HttpUrl {

    String message() default "deve essere un URL http o https valido (massimo 2048 caratteri)";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}

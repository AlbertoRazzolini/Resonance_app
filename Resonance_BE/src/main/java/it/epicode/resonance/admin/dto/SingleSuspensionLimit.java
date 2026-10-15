package it.epicode.resonance.admin.dto;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Una sospensione ha al massimo un limite: una data oppure una durata in giorni, non entrambe (progettazione,
 * sezione 5.5). L'errore e' riportato su entrambi i campi.
 */
@Documented
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = SingleSuspensionLimitValidator.class)
public @interface SingleSuspensionLimit {

    String message() default "indicare una data di fine oppure una durata in giorni, non entrambe";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}

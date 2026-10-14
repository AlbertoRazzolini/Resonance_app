package it.epicode.resonance.common;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import jakarta.validation.ReportAsSingleViolation;
import jakarta.validation.constraints.Pattern;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * "Non vuoto" per i campi obbligatori dei PATCH, dove @NotBlank non si puo' usare perche' il campo
 * puo' mancare: se e' presente deve contenere almeno un carattere che non sia uno spazio. Null e'
 * valido (progettazione, sezione 6.1).
 */
@Documented
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = {})
@Pattern(regexp = "(?s).*\\S.*", message = "non deve essere vuoto")
@ReportAsSingleViolation
public @interface NotBlankIfPresent {

    String message() default "non deve essere vuoto";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}

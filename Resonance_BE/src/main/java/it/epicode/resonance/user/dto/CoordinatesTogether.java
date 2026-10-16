package it.epicode.resonance.user.dto;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Latitudine e longitudine si inviano insieme o non si inviano affatto (progettazione, sezioni 6.5 e 6.8): una
 * sola coordinata non ha senso. L'errore e' riportato su entrambi i campi. Vale per ogni {@link HasCoordinates}.
 */
@Documented
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = CoordinatesTogetherValidator.class)
public @interface CoordinatesTogether {

    String message() default "latitudine e longitudine vanno indicate insieme";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}

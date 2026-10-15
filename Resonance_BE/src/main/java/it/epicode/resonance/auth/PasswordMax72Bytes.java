package it.epicode.resonance.auth;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Password NUOVA (registrazione, reset): al massimo 72 byte in UTF-8, il limite reale di BCrypt, oltre al
 * limite di 72 caratteri di {@code @Size} (progettazione, sezioni 4.4 e 6.4). Le password da CONTROLLARE
 * non usano questa annotazione: oltre i 72 byte si risponde come per una password errata
 * ({@link PasswordMax72BytesValidator#exceedsLimit}).
 */
@Documented
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = PasswordMax72BytesValidator.class)
public @interface PasswordMax72Bytes {

    String message() default "non deve superare i 72 byte";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}

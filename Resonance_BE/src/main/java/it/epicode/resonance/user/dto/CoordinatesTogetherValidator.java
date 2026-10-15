package it.epicode.resonance.user.dto;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * Validatore di {@link CoordinatesTogether}: le due coordinate sono entrambe presenti o entrambe assenti.
 */
public class CoordinatesTogetherValidator implements ConstraintValidator<CoordinatesTogether, UpdateProfileRequest> {

    @Override
    public boolean isValid(UpdateProfileRequest request, ConstraintValidatorContext context) {
        if (request == null || (request.latitude() == null) == (request.longitude() == null)) {
            return true;
        }
        // Violazione sui campi e non sulla classe: il frontend legge fields.latitude e fields.longitude.
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
                .addPropertyNode("latitude").addConstraintViolation();
        context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
                .addPropertyNode("longitude").addConstraintViolation();
        return false;
    }
}

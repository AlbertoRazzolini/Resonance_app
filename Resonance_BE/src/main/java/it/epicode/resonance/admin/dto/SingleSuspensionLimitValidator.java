package it.epicode.resonance.admin.dto;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * Validatore di {@link SingleSuspensionLimit}: data di fine e durata non sono mai presenti insieme.
 */
public class SingleSuspensionLimitValidator implements ConstraintValidator<SingleSuspensionLimit, SuspendUserRequest> {

    @Override
    public boolean isValid(SuspendUserRequest request, ConstraintValidatorContext context) {
        if (request == null || request.suspendedUntil() == null || request.durationDays() == null) {
            return true;
        }
        // Violazione sui campi e non sulla classe: il frontend legge fields.suspendedUntil e fields.durationDays.
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
                .addPropertyNode("suspendedUntil").addConstraintViolation();
        context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
                .addPropertyNode("durationDays").addConstraintViolation();
        return false;
    }
}

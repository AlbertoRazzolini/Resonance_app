package it.epicode.resonance.common;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.net.URI;
import java.net.URISyntaxException;

/**
 * Validatore di {@link HttpUrl}: schema http o https, host presente, lunghezza massima 2048.
 */
public class HttpUrlValidator implements ConstraintValidator<HttpUrl, String> {

    private static final int MAX_LENGTH = 2048;

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        // Facoltativo: null e vuoto sono validi, la presenza la controlla @NotBlank dove serve.
        if (value == null || value.isBlank()) {
            return true;
        }
        if (value.length() > MAX_LENGTH) {
            return false;
        }
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();
            boolean httpScheme = "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
            return httpScheme && uri.getHost() != null && !uri.getHost().isBlank();
        } catch (URISyntaxException e) {
            return false;
        }
    }
}

package it.epicode.resonance.common;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * @HttpUrl accetta solo URL http/https (blocca javascript: e simili) e al massimo 2048 caratteri
 * (progettazione, sezione 8.6).
 */
class HttpUrlValidatorTest {

    private record Dto(@HttpUrl String url) {
    }

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private boolean isValid(String url) {
        return validator.validate(new Dto(url)).isEmpty();
    }

    @Test
    void httpAndHttpsUrls_areValid() {
        assertThat(isValid("http://example.com/a.png")).isTrue();
        assertThat(isValid("https://example.com/path?x=1#top")).isTrue();
        assertThat(isValid("HTTPS://Example.com")).isTrue();
    }

    @Test
    void nullAndBlank_areValid() {
        // Facoltativo: il service trasforma la stringa vuota in "campo svuotato" (progettazione, sezione 6.1).
        assertThat(isValid(null)).isTrue();
        assertThat(isValid("")).isTrue();
        assertThat(isValid("   ")).isTrue();
    }

    @Test
    void javascriptUrl_isRejected() {
        assertThat(isValid("javascript:alert(1)")).isFalse();
    }

    @Test
    void otherSchemes_areRejected() {
        assertThat(isValid("ftp://example.com/file")).isFalse();
        assertThat(isValid("data:text/html;base64,PHNjcmlwdD4=")).isFalse();
        assertThat(isValid("file:///etc/passwd")).isFalse();
    }

    @Test
    void urlWithoutHost_isRejected() {
        assertThat(isValid("http://")).isFalse();
        assertThat(isValid("https:///solo-percorso")).isFalse();
    }

    @Test
    void malformedUrl_isRejected() {
        assertThat(isValid("http://exa mple.com")).isFalse();
        assertThat(isValid("non e' un url")).isFalse();
    }

    @Test
    void urlOver2048Characters_isRejected() {
        String longUrl = "https://example.com/" + "a".repeat(2048);

        assertThat(isValid(longUrl)).isFalse();
        assertThat(isValid("https://example.com/" + "a".repeat(2000))).isTrue();
    }
}

package it.epicode.resonance.user;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Costruzione di User e regole che non dipendono dal database.
 */
class UserTest {

    @Test
    void constructor_setsRequiredFieldsAndInitialState() {
        User user = new User("mario@example.com", "hash-di-prova", "Mario");

        assertThat(user.getEmail()).isEqualTo("mario@example.com");
        assertThat(user.getPasswordHash()).isEqualTo("hash-di-prova");
        assertThat(user.getDisplayName()).isEqualTo("Mario");
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(user.isEmailVerified()).isFalse();
    }

    @Test
    void toString_doesNotExposePasswordHash() {
        // L'hash non deve finire nei log (progettazione, sezione 8.9).
        User user = new User("mario@example.com", "hash-segreto", "Mario");

        assertThat(user.toString()).contains("mario@example.com").doesNotContain("hash-segreto");
    }
}

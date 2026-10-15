package it.epicode.resonance.common;

import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * Il nome del vincolo violato si legge dall'errore reale di PostgreSQL, da cui dipende il codice
 * d'errore restituito al client (progettazione, sezione 3 e 6.2).
 */
class ConstraintNameTest extends IntegrationTest {

    @Autowired
    private UserRepository users;

    @Test
    void duplicateEmail_exposesTheConstraintName() {
        users.saveAndFlush(new User("mario@example.com", "hash-1", "Mario"));

        DataIntegrityViolationException ex = catchThrowableOfType(DataIntegrityViolationException.class,
                () -> users.saveAndFlush(new User("mario@example.com", "hash-2", "Altro Mario")));

        assertThat(ex).isNotNull();
        assertThat(GlobalExceptionHandler.constraintName(ex)).isEqualTo("uq_users_email");
    }
}

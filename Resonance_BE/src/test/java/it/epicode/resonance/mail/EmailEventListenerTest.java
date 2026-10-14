package it.epicode.resonance.mail;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

/**
 * Il listener inoltra ogni evento al metodo giusto di {@link EmailService}; i valori di timing (dopo il
 * commit, asincrono) sono verificati dai test di integrazione della registrazione.
 */
class EmailEventListenerTest {

    private final EmailService emailService = Mockito.mock(EmailService.class);
    private final EmailEventListener listener = new EmailEventListener(emailService);

    @Test
    void handle_forwardsVerificationCodeEvent() {
        listener.handle(new VerificationCodeEmailEvent("mario@example.com", "Mario", "123456"));

        verify(emailService).sendVerificationCode("mario@example.com", "Mario", "123456");
    }

    @Test
    void handle_forwardsPasswordResetCodeEvent() {
        listener.handle(new PasswordResetCodeEmailEvent("mario@example.com", "Mario", "654321"));

        verify(emailService).sendPasswordResetCode("mario@example.com", "Mario", "654321");
    }

    @Test
    void handle_forwardsPasswordChangedEvent() {
        listener.handle(new PasswordChangedEmailEvent("mario@example.com", "Mario"));

        verify(emailService).sendPasswordChanged("mario@example.com", "Mario");
    }

    @Test
    void eventsDoNotRevealTheCodeInToString() {
        // Il codice e' un segreto: un evento finito per errore in un log non lo mostra.
        assertThat(new VerificationCodeEmailEvent("mario@example.com", "Mario", "123456").toString())
                .doesNotContain("123456");
        assertThat(new PasswordResetCodeEmailEvent("mario@example.com", "Mario", "654321").toString())
                .doesNotContain("654321");
    }
}

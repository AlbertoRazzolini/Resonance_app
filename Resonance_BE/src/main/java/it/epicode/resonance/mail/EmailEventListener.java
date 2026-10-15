package it.epicode.resonance.mail;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Invia le email DOPO il commit e in modo asincrono (progettazione, sezione 9): se la transazione annulla,
 * l'email non parte; se l'invio fallisce {@link EmailService} scrive nel log e la richiesta resta valida.
 */
@Component
public class EmailEventListener {

    private final EmailService emailService;

    public EmailEventListener(EmailService emailService) {
        this.emailService = emailService;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(VerificationCodeEmailEvent event) {
        emailService.sendVerificationCode(event.recipient(), event.displayName(), event.code());
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(PasswordResetCodeEmailEvent event) {
        emailService.sendPasswordResetCode(event.recipient(), event.displayName(), event.code());
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(PasswordChangedEmailEvent event) {
        emailService.sendPasswordChanged(event.recipient(), event.displayName());
    }
}

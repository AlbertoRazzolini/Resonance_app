package it.epicode.resonance.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

/**
 * Versione finta di {@link EmailService} per sviluppo e test: scrive nel log, codice compreso, per lavorare
 * senza credenziali. Eccezione voluta alla regola "mai codici nei log" e non attiva in produzione
 * (progettazione, sezioni 8.9 e 9).
 */
@Service
@Profile("!prod")
public class LogEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(LogEmailService.class);

    @Override
    public void sendVerificationCode(String recipient, String displayName, String code) {
        log.info("[EMAIL FINTA] Codice di verifica -> {} ({}): codice={}", displayName, recipient, code);
    }

    @Override
    public void sendPasswordResetCode(String recipient, String displayName, String code) {
        log.info("[EMAIL FINTA] Codice di reset password -> {} ({}): codice={}", displayName, recipient, code);
    }

    @Override
    public void sendPasswordChanged(String recipient, String displayName) {
        log.info("[EMAIL FINTA] Password cambiata -> {} ({})", displayName, recipient);
    }
}

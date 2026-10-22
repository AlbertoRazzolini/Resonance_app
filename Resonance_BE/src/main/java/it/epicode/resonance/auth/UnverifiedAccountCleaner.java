package it.epicode.resonance.auth;

import it.epicode.resonance.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

/**
 * Elimina gli account mai verificati dopo 24 ore dall'ultimo invio del codice, cosi' il loro nome torna libero
 * (decisione 96, progettazione, sezione 4.4).
 */
@Component
public class UnverifiedAccountCleaner {

    private static final Logger log = LoggerFactory.getLogger(UnverifiedAccountCleaner.class);
    private static final Duration MAX_AGE = Duration.ofHours(24);

    private final UserRepository users;
    private final Clock clock;

    public UnverifiedAccountCleaner(UserRepository users, Clock clock) {
        this.users = users;
        this.clock = clock;
    }

    /**
     * Ogni ora, e una volta all'avvio: sul servizio gratuito di Render l'applicazione si sospende e un'esecuzione
     * al giorno potrebbe non partire mai (progettazione, sezione 4.11). Il conteggio parte dall'ultimo invio del
     * codice, non dalla creazione, perche' chi si registra di nuovo con la stessa email riceve un codice nuovo.
     */
    @Scheduled(fixedDelay = 1, timeUnit = TimeUnit.HOURS)
    @Transactional
    public void deleteStale() {
        int deleted = users.deleteUnverifiedWithoutRecentCode(clock.instant().minus(MAX_AGE));
        if (deleted > 0) {
            log.info("Eliminati {} account non verificati scaduti", deleted);
        }
    }
}
